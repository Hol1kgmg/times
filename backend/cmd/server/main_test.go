package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Hol1kgmg/times/backend/internal/api"
	"github.com/Hol1kgmg/times/backend/internal/apperr"
	"github.com/Hol1kgmg/times/backend/internal/handler"
	"github.com/gin-gonic/gin"
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

// DB なしで到達できる経路だけ確認する: ルーティング、リクエスト検証、エラー変換の配線
func TestRouter(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r, err := newRouter(stub{Server: handler.New(nil), getItem: apperr.NotFound("gone")})
	if err != nil {
		t.Fatal(err)
	}
	const id = "/items/3f2a0c1e-0000-4000-8000-000000000000"

	tests := []struct {
		method, path, body string
		want               int
		wantType           api.ProblemType
	}{
		{"GET", "/healthz", "", http.StatusOK, ""},
		{"POST", "/items", `{"title":""}`, http.StatusBadRequest, api.ProblemsvalidationFailed},
		{"POST", "/items", `{}`, http.StatusBadRequest, api.ProblemsvalidationFailed},
		{"POST", "/items", `not json`, http.StatusBadRequest, api.ProblemsvalidationFailed},
		{"GET", "/items/not-a-uuid", "", http.StatusBadRequest, api.ProblemsvalidationFailed},
		{"POST", "/items", `{"title":"` + strings.Repeat("a", maxBodyBytes) + `"}`, http.StatusBadRequest, api.ProblemsvalidationFailed},
		{"GET", id, "", http.StatusNotFound, api.ProblemsnotFound},
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
		r, _ := newRouter(stub{Server: handler.New(nil), getItem: err})
		w := do(r, "GET", "/items/3f2a0c1e-0000-4000-8000-000000000000", "")
		p := problem(t, w)
		if w.Code != 500 || p.Type != api.AboutBlank || p.Detail != nil || strings.Contains(w.Body.String(), "boom") {
			t.Errorf("%s: got %d %s", name, w.Code, w.Body)
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
