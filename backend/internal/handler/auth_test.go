package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Hol1kgmg/times/backend/internal/api"
	"github.com/Hol1kgmg/times/backend/internal/apperr"
	"github.com/Hol1kgmg/times/backend/internal/auth"
	"github.com/Hol1kgmg/times/backend/internal/db"
)

// fakeQueries は呼ばれた引数を記録するだけ。DB には繋がない
type fakeQueries struct {
	upserted *db.UpsertUserParams
	created  *db.CreateSessionParams
	deleted  [][]byte
}

func (f *fakeQueries) UpsertUser(_ context.Context, arg db.UpsertUserParams) (db.User, error) {
	f.upserted = &arg
	return db.User{ID: arg.ID, Login: arg.Login}, nil
}

func (f *fakeQueries) CreateSession(_ context.Context, arg db.CreateSessionParams) (db.Session, error) {
	f.created = &arg
	return db.Session{TokenHash: arg.TokenHash, UserID: arg.UserID, CreatedAt: time.Now(), ExpiresAt: arg.ExpiresAt}, nil
}

func (f *fakeQueries) DeleteExpiredSessions(context.Context) error { return nil }

func (f *fakeQueries) DeleteSessionByTokenHash(_ context.Context, h []byte) error {
	f.deleted = append(f.deleted, h)
	return nil
}

// GitHub を模す。code をそのまま access_token にし、token ごとにユーザーを返す
func fakeGitHub(t *testing.T) auth.Client {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("POST /login/oauth/access_token", func(w http.ResponseWriter, r *http.Request) {
		var in struct{ Code string }
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil || in.Code == "" {
			w.Write([]byte(`{"error":"bad_verification_code"}`))
			return
		}
		w.Write([]byte(`{"access_token":"` + in.Code + `"}`))
	})
	mux.HandleFunc("GET /user", func(w http.ResponseWriter, r *http.Request) {
		switch r.Header.Get("Authorization") {
		case "Bearer admin":
			w.Write([]byte(`{"id":1,"login":"Octocat"}`))
		case "Bearer other":
			w.Write([]byte(`{"id":2,"login":"someone"}`))
		default:
			w.WriteHeader(401)
		}
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return auth.Client{HTTP: srv.Client(), BaseURL: srv.URL, APIURL: srv.URL, ClientID: "id", ClientSecret: "secret"}
}

func newAuthServer(t *testing.T) (*Server, *fakeQueries) {
	q := &fakeQueries{}
	return &Server{authq: q, gh: fakeGitHub(t), adminLogin: "octocat", authConfigured: true}, q
}

func createSession(s *Server, code string) (api.CreateSessionResponseObject, error) {
	return s.CreateSession(context.Background(), api.CreateSessionRequestObject{Body: &api.NewSession{Code: code, RedirectUri: "https://app/cb"}})
}

func wantStatus(t *testing.T, err error, status int) {
	t.Helper()
	var e *apperr.Error
	if !errors.As(err, &e) || e.Status != status {
		t.Errorf("got %v, want status %d", err, status)
	}
}

func TestCreateSessionNotConfigured(t *testing.T) {
	s, q := newAuthServer(t)
	s.authConfigured = false
	_, err := createSession(s, "admin")
	wantStatus(t, err, http.StatusForbidden)
	if q.upserted != nil {
		t.Error("must not touch users")
	}
}

func TestCreateSessionUpstreamFailed(t *testing.T) {
	s, _ := newAuthServer(t)
	_, err := createSession(s, "garbage")
	wantStatus(t, err, http.StatusBadGateway)
}

func TestCreateSessionForbidden(t *testing.T) {
	s, q := newAuthServer(t)
	_, err := createSession(s, "other")
	wantStatus(t, err, http.StatusForbidden)
	if q.upserted != nil || q.created != nil {
		t.Error("must not save anything for a disallowed account")
	}
}

// login は大文字小文字を区別しない (Octocat vs octocat)
func TestCreateSessionOK(t *testing.T) {
	s, q := newAuthServer(t)
	res, err := createSession(s, "admin")
	if err != nil {
		t.Fatal(err)
	}
	out := res.(api.CreateSession201JSONResponse)
	if q.upserted == nil || q.upserted.ID != 1 || q.upserted.Login != "Octocat" {
		t.Errorf("upsert: %+v", q.upserted)
	}
	if len(out.Token) != 43 || out.User.Id != 1 || out.User.Login != "Octocat" {
		t.Errorf("response: %+v", out)
	}
	if q.created == nil || string(q.created.TokenHash) != string(auth.Hash(out.Token)) {
		t.Errorf("session must store sha256 of the token: %+v", q.created)
	}
	if d := time.Until(out.ExpiresAt) - sessionTTL; d < -time.Minute || d > time.Minute {
		t.Errorf("expiresAt: %v (off by %v)", out.ExpiresAt, d)
	}
}

func TestCurrentSession(t *testing.T) {
	s, q := newAuthServer(t)
	p := auth.Principal{UserID: 1, Login: "octocat", ExpiresAt: time.Now(), TokenHash: []byte("h")}
	ctx := auth.WithPrincipal(context.Background(), p)

	got, err := s.GetCurrentSession(ctx, api.GetCurrentSessionRequestObject{})
	if err != nil || got.(api.GetCurrentSession200JSONResponse).User.Id != 1 {
		t.Errorf("get: %+v, %v", got, err)
	}
	if _, err := s.GetCurrentSession(context.Background(), api.GetCurrentSessionRequestObject{}); err == nil {
		t.Error("get without principal must fail")
	} else {
		wantStatus(t, err, http.StatusUnauthorized)
	}

	if _, err := s.DeleteCurrentSession(ctx, api.DeleteCurrentSessionRequestObject{}); err != nil || len(q.deleted) != 1 || string(q.deleted[0]) != "h" {
		t.Errorf("delete: %v, %v", err, q.deleted)
	}
	_, err = s.DeleteCurrentSession(context.Background(), api.DeleteCurrentSessionRequestObject{})
	wantStatus(t, err, http.StatusUnauthorized)
}
