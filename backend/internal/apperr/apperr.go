// Package apperr は handler が返す想定内の失敗を表す。
// 配線層 (cmd/server) がこれを RFC 9457 Problem Details に変換する。
// ADR: adr/backend/0002-return-errors-as-rfc9457-problem-details.md
package apperr

import (
	"fmt"
	"net/http"
	"time"
)

// title は持たない。status の reason phrase を writeProblem が導出する。
type Error struct {
	Status int
	Type   string
	Detail string
	// url-already-registered と repost-unavailable のときだけ。Problem の拡張メンバー duplicateUrls になる
	DuplicateURLs []string
	// url-already-registered のときだけ。Problem の拡張メンバー repostable になる
	Repostable []Repostable
	// parent-has-children のときだけ。Problem の拡張メンバー hideable になる
	Hideable []Hideable
}

// 画面が外した行を隠した行として戻すのに使う、外せない親
type Hideable struct {
	URL, Title, Category string
}

// 画面が断られた行を再掲載に切り替えるのに使う元の記事 (specs/018 FR-007)
type Repostable struct {
	URL, Title, Category string
	FirstPublishedOn     time.Time
}

func (e *Error) Error() string { return e.Type + ": " + e.Detail }

// Types は type URI とその status の対応表。openapi.yaml の Problem.type enum と一致させる (テストで検証)。
var Types = map[string]int{
	"/problems/validation-failed": http.StatusBadRequest,
	"/problems/not-found":         http.StatusNotFound,
	"/problems/unauthorized":      http.StatusUnauthorized,
	"/problems/forbidden":         http.StatusForbidden,
	"/problems/upstream-failed":   http.StatusBadGateway,
	// 業務ルール違反だが、入力を直せば通るので 409 ではなく 400 に揃える
	"/problems/url-already-registered": http.StatusBadRequest,
	"/problems/digest-already-exists":  http.StatusBadRequest,
	"/problems/future-publish":         http.StatusBadRequest,
	"/problems/repost-unavailable":     http.StatusBadRequest,
	"/problems/parent-has-children":    http.StatusBadRequest,
}

func newError(typ, detail string) error {
	return &Error{Status: Types[typ], Type: typ, Detail: detail}
}

func ValidationFailed(detail string) error { return newError("/problems/validation-failed", detail) }
func NotFound(detail string) error         { return newError("/problems/not-found", detail) }
func Unauthorized(detail string) error     { return newError("/problems/unauthorized", detail) }
func Forbidden(detail string) error        { return newError("/problems/forbidden", detail) }
func UpstreamFailed(detail string) error   { return newError("/problems/upstream-failed", detail) }
func DigestAlreadyExists(detail string) error {
	return newError("/problems/digest-already-exists", detail)
}
func FuturePublish(detail string) error { return newError("/problems/future-publish", detail) }

func URLAlreadyRegistered(urls []string, repostable []Repostable) error {
	typ := "/problems/url-already-registered"
	// 画面が切り替える行の有無を、項目の有無ではなく空の配列で見られるようにする
	if repostable == nil {
		repostable = []Repostable{}
	}
	return &Error{Status: Types[typ], Type: typ, Detail: fmt.Sprintf("%d urls already registered", len(urls)), DuplicateURLs: urls, Repostable: repostable}
}

func RepostUnavailable(urls []string) error {
	typ := "/problems/repost-unavailable"
	return &Error{Status: Types[typ], Type: typ, Detail: fmt.Sprintf("%d reposts have no earlier published article", len(urls)), DuplicateURLs: urls}
}

func ParentHasChildren(parents []Hideable) error {
	typ := "/problems/parent-has-children"
	return &Error{Status: Types[typ], Type: typ, Detail: fmt.Sprintf("%d parents have children in other digests", len(parents)), Hideable: parents}
}
