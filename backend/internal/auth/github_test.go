package auth

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Hol1kgmg/times/backend/internal/apperr"
)

// GitHub を模す。tokenBody は access_token 応答、userStatus は /user のステータス
func fakeGitHub(t *testing.T, tokenBody string, userStatus int) Client {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("POST /login/oauth/access_token", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Accept") != "application/json" {
			t.Errorf("Accept: %q", r.Header.Get("Accept"))
		}
		w.Write([]byte(tokenBody))
	})
	mux.HandleFunc("GET /user", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer tok" || r.Header.Get("User-Agent") != "times-backend" {
			t.Errorf("headers: %v", r.Header)
		}
		w.WriteHeader(userStatus)
		w.Write([]byte(`{"id": 42, "login": "octocat"}`))
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return Client{HTTP: srv.Client(), BaseURL: srv.URL, APIURL: srv.URL, ClientID: "id", ClientSecret: "secret"}
}

func TestExchange(t *testing.T) {
	u, err := fakeGitHub(t, `{"access_token":"tok"}`, 200).Exchange(context.Background(), "code", "https://app/cb")
	if err != nil || u != (User{ID: 42, Login: "octocat"}) {
		t.Errorf("got %+v, %v", u, err)
	}
}

func TestExchangeUpstreamFailed(t *testing.T) {
	for name, c := range map[string]Client{
		"token error": fakeGitHub(t, `{"error":"bad_verification_code"}`, 200),
		"user 401":    fakeGitHub(t, `{"access_token":"tok"}`, 401),
		"not json":    fakeGitHub(t, `<html>`, 200),
	} {
		_, err := c.Exchange(context.Background(), "code", "https://app/cb")
		var e *apperr.Error
		if !errors.As(err, &e) || e.Status != http.StatusBadGateway {
			t.Errorf("%s: got %v, want 502", name, err)
		}
	}
}
