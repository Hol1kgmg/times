package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Hol1kgmg/times/backend/internal/handler"
	"github.com/gin-gonic/gin"
)

// DB なしで到達できる経路だけ確認する: ルーティングとリクエスト検証の配線
func TestRouter(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r, err := newRouter(handler.New(nil))
	if err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		method, path, body string
		want               int
	}{
		{"GET", "/healthz", "", http.StatusOK},
		{"POST", "/items", `{"title":""}`, http.StatusBadRequest},
		{"POST", "/items", `{}`, http.StatusBadRequest},
		{"POST", "/items", `not json`, http.StatusBadRequest},
	}
	for _, tt := range tests {
		req := httptest.NewRequest(tt.method, tt.path, strings.NewReader(tt.body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code != tt.want {
			t.Errorf("%s %s %q: got %d, want %d (%s)", tt.method, tt.path, tt.body, w.Code, tt.want, w.Body)
		}
	}
}
