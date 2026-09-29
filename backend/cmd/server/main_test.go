package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Hol1kgmg/times/backend/internal/api"
	"github.com/Hol1kgmg/times/backend/internal/apperr"
	"github.com/Hol1kgmg/times/backend/internal/auth"
	"github.com/Hol1kgmg/times/backend/internal/db"
	"github.com/Hol1kgmg/times/backend/internal/handler"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

// stub は GetItem だけ差し替えて、handler が返した error の変換経路を確認する
type stub struct {
	*handler.Server
	getItem error
}

func (s stub) GetItem(context.Context, api.GetItemRequestObject) (api.GetItemResponseObject, error) {
	if s.getItem == nil {
		panic("boom")
	}
	return nil, s.getItem
}

func (s stub) GetLatestDigest(context.Context, api.GetLatestDigestRequestObject) (api.GetLatestDigestResponseObject, error) {
	return nil, s.getItem
}

// DeleteCurrentSession は DB を触るので差し替える。Principal が載っていることだけ確認する
func (s stub) DeleteCurrentSession(ctx context.Context, _ api.DeleteCurrentSessionRequestObject) (api.DeleteCurrentSessionResponseObject, error) {
	if _, ok := auth.PrincipalFrom(ctx); !ok {
		return nil, errors.New("no principal")
	}
	return api.DeleteCurrentSession204Response{}, nil
}

func newStub(getItem error) stub {
	return stub{Server: handler.New(nil, auth.Client{}, ""), getItem: getItem}
}

// lookup が呼ばれたらテスト失敗にする。security の無い操作で照合しないことの確認用
func noLookup(t *testing.T) sessionLookup {
	return func(context.Context, []byte) (db.GetSessionByTokenHashRow, error) {
		t.Error("lookup must not be called")
		return db.GetSessionByTokenHashRow{}, pgx.ErrNoRows
	}
}

// DB なしで到達できる経路だけ確認する: ルーティング、リクエスト検証、エラー変換の配線
func TestRouter(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r, err := newRouter(newStub(apperr.NotFound("gone")), "", noLookup(t))
	if err != nil {
		t.Fatal(err)
	}
	const id = "/items/3f2a0c1e-0000-4000-8000-000000000000"

	tests := []struct {
		method, path, body string
		want               int
		wantType           api.ProblemType
	}{
		{"GET", "/health", "", http.StatusOK, ""},
		{"POST", "/items", `{"title":""}`, http.StatusBadRequest, api.ProblemsvalidationFailed},
		{"POST", "/items", `{}`, http.StatusBadRequest, api.ProblemsvalidationFailed},
		{"POST", "/items", `not json`, http.StatusBadRequest, api.ProblemsvalidationFailed},
		{"GET", "/items/not-a-uuid", "", http.StatusBadRequest, api.ProblemsvalidationFailed},
		{"POST", "/items", `{"title":"` + strings.Repeat("a", maxBodyBytes) + `"}`, http.StatusBadRequest, api.ProblemsvalidationFailed},
		{"GET", id, "", http.StatusNotFound, api.ProblemsnotFound},
		{"GET", "/digests/latest", "", http.StatusNotFound, api.ProblemsnotFound},
		{"POST", "/auth/sessions", `{"code":"","redirectUri":"https://app/cb"}`, http.StatusBadRequest, api.ProblemsvalidationFailed},
		{"POST", "/auth/sessions", `{"code":"x"}`, http.StatusBadRequest, api.ProblemsvalidationFailed},
		{"POST", "/auth/sessions", `{"code":"x","redirectUri":"https://app/cb"}`, http.StatusForbidden, api.Problemsforbidden}, // 未設定
	}
	for _, tt := range tests {
		w := do(r, tt.method, tt.path, tt.body)
		if w.Code != tt.want {
			t.Errorf("%s %s %q: got %d, want %d (%s)", tt.method, tt.path, tt.body, w.Code, tt.want, w.Body)
		}
		if tt.wantType == "" {
			continue
		}
		p := problem(t, w)
		if p.Type != tt.wantType || p.Status != tt.want || p.Title != http.StatusText(tt.want) {
			t.Errorf("%s %s: got %+v, want type=%s status=%d", tt.method, tt.path, p, tt.wantType, tt.want)
		}
	}

	if p := problem(t, do(r, "GET", id, "")); p.Detail == nil || *p.Detail != "gone" {
		t.Errorf("404 detail: got %v, want gone", p.Detail)
	}
}

// 想定外の error と panic は 500 にし、文言を漏らさない
func TestUnexpectedError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for name, err := range map[string]error{"error": errors.New("boom"), "panic": nil} {
		r, _ := newRouter(newStub(err), "", noLookup(t))
		w := do(r, "GET", "/items/3f2a0c1e-0000-4000-8000-000000000000", "")
		p := problem(t, w)
		if w.Code != 500 || p.Type != api.AboutBlank || p.Detail != nil || strings.Contains(w.Body.String(), "boom") {
			t.Errorf("%s: got %d %s", name, w.Code, w.Body)
		}
	}
}

// token を渡すと X-Backend-Token が一致しない要求は 401 になる。/health も例外にしない
func TestBackendToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r, _ := newRouter(newStub(nil), "s3cret", noLookup(t))
	for header, want := range map[string]int{"": 401, "wrong": 401, "s3cret": 200} {
		req := httptest.NewRequest("GET", "/health", nil)
		req.Header.Set("X-Backend-Token", header)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code != want {
			t.Errorf("token %q: got %d, want %d (%s)", header, w.Code, want, w.Body)
		}
		if want == 401 && problem(t, w).Type != api.Problemsunauthorized {
			t.Errorf("token %q: type %s", header, w.Body)
		}
	}
}

// security: [bearerAuth] の操作は Authorization: Bearer を sha256 → lookup で照合し、失敗は 401。
// security の無い /health では lookup が呼ばれない
func TestBearerAuth(t *testing.T) {
	gin.SetMode(gin.TestMode)
	expires := time.Now().Add(time.Hour).Truncate(time.Second)
	var calls int
	lookup := func(_ context.Context, hash []byte) (db.GetSessionByTokenHashRow, error) {
		calls++
		if string(hash) != string(auth.Hash("valid")) {
			return db.GetSessionByTokenHashRow{}, pgx.ErrNoRows
		}
		return db.GetSessionByTokenHashRow{UserID: 1, Login: "octocat", ExpiresAt: expires}, nil
	}
	r, _ := newRouter(newStub(nil), "", lookup)

	tests := []struct {
		method, path, authz string
		want                int
		wantLookup          bool
	}{
		{"GET", "/auth/sessions/current", "", 401, false},
		{"GET", "/auth/sessions/current", "Basic x", 401, false},
		{"GET", "/auth/sessions/current", "Bearer garbage", 401, true},
		{"GET", "/auth/sessions/current", "Bearer valid", 200, true},
		{"DELETE", "/auth/sessions/current", "", 401, false},
		{"DELETE", "/auth/sessions/current", "Bearer valid", 204, true},
		{"GET", "/health", "Bearer valid", 200, false},
	}
	for _, tt := range tests {
		calls = 0
		req := httptest.NewRequest(tt.method, tt.path, nil)
		if tt.authz != "" {
			req.Header.Set("Authorization", tt.authz)
		}
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code != tt.want || (calls > 0) != tt.wantLookup {
			t.Errorf("%s %s %q: got %d (lookup %d), want %d (%s)", tt.method, tt.path, tt.authz, w.Code, calls, tt.want, w.Body)
			continue
		}
		if tt.want == 401 && problem(t, w).Type != api.Problemsunauthorized {
			t.Errorf("%s %s %q: %s", tt.method, tt.path, tt.authz, w.Body)
		}
		if tt.want == 200 && tt.path != "/health" {
			var s api.Session
			if err := json.Unmarshal(w.Body.Bytes(), &s); err != nil || s.User.Id != 1 || s.User.Login != "octocat" || !s.ExpiresAt.Equal(expires) {
				t.Errorf("session body: %s (%v)", w.Body, err)
			}
		}
	}
}

// openapi.yaml の Problem.type enum と apperr.Types が一致する
func TestProblemTypesMatchSpec(t *testing.T) {
	spec, err := api.GetSwagger()
	if err != nil {
		t.Fatal(err)
	}
	inSpec := map[string]bool{}
	for _, v := range spec.Components.Schemas["Problem"].Value.Properties["type"].Value.Enum {
		inSpec[v.(string)] = true
	}
	delete(inSpec, string(api.AboutBlank)) // 想定外用。apperr には無い
	for typ := range apperr.Types {
		if !inSpec[typ] {
			t.Errorf("apperr.Types has %s but openapi.yaml does not", typ)
		}
		delete(inSpec, typ)
	}
	for typ := range inSpec {
		t.Errorf("openapi.yaml has %s but apperr.Types does not", typ)
	}
}

func do(r http.Handler, method, path, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func problem(t *testing.T, w *httptest.ResponseRecorder) api.Problem {
	t.Helper()
	if ct := w.Header().Get("Content-Type"); ct != "application/problem+json" {
		t.Errorf("Content-Type: got %q", ct)
	}
	var p api.Problem
	if err := json.Unmarshal(w.Body.Bytes(), &p); err != nil {
		t.Fatalf("body %s: %v", w.Body, err)
	}
	return p
}
