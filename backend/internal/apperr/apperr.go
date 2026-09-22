// Package apperr は handler が返す想定内の失敗を表す。
// 配線層 (cmd/server) がこれを RFC 9457 Problem Details に変換する。
// ADR: adr/backend/0002-return-errors-as-rfc9457-problem-details.md
package apperr

import "net/http"

// title は持たない。status の reason phrase を writeProblem が導出する。
type Error struct {
	Status int
	Type   string
	Detail string
}

func (e *Error) Error() string { return e.Type + ": " + e.Detail }

// Types は type URI とその status の対応表。openapi.yaml の Problem.type enum と一致させる (テストで検証)。
var Types = map[string]int{
	"/problems/validation-failed": http.StatusBadRequest,
	"/problems/not-found":         http.StatusNotFound,
	"/problems/conflict":          http.StatusConflict,
}

func newError(typ, detail string) error {
	return &Error{Status: Types[typ], Type: typ, Detail: detail}
}

func ValidationFailed(detail string) error { return newError("/problems/validation-failed", detail) }
func NotFound(detail string) error         { return newError("/problems/not-found", detail) }
func Conflict(detail string) error         { return newError("/problems/conflict", detail) }
