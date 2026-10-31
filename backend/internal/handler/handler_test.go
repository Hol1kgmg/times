package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"testing"
	"time"

	"github.com/Hol1kgmg/times/backend/internal/api"
	"github.com/Hol1kgmg/times/backend/internal/apperr"
	"github.com/Hol1kgmg/times/backend/internal/db"
	"github.com/google/uuid"
	"github.com/jackc/pgerrcode"
	"github.com/jackc/pgx/v5/pgconn"
)

// unique / check 違反は 400、それ以外の DB エラーはそのまま (500 になる)
func TestConstraintViolation(t *testing.T) {
	unique := &pgconn.PgError{Code: pgerrcode.UniqueViolation, ConstraintName: "articles_created_by_url_key"}
	var e *apperr.Error
	if err := constraintViolation(fmt.Errorf("wrap: %w", unique)); !errors.As(err, &e) || e.Status != 400 {
		t.Errorf("unique: got %v", err)
	}
	// 作成からの同じ日付への追記は、画面が日付欄を示せるよう専用の type にする
	date := &pgconn.PgError{Code: pgerrcode.UniqueViolation, ConstraintName: "digests_created_by_entry_date_key"}
	if err := constraintViolation(date); !errors.As(err, &e) || e.Type != "/problems/digest-already-exists" {
		t.Errorf("date: got %v", err)
	}
	other := &pgconn.PgError{Code: pgerrcode.ConnectionFailure}
	if err := constraintViolation(other); errors.As(err, &e) || err != other {
		t.Errorf("other: got %v", err)
	}
}

// 登録済みの照合は関連記事の URL も対象にする。漏れると印が付かず DB の unique で汎用エラーになる
func TestURLsOfIncludesChildren(t *testing.T) {
	children := []api.NewChildArticle{{Title: "a-child", Url: "https://a.example/child"}}
	articles := []api.NewArticle{
		{Title: "a", Url: "https://a.example", Children: &children},
		{Title: "b", Url: "https://b.example"},
	}
	got := urlsOf(articles)
	want := []string{"https://a.example", "https://a.example/child", "https://b.example"}
	if !slices.Equal(got, want) {
		t.Errorf("got %v, want %v", got, want)
	}
}

// DB 行 → API 応答の変換: 日付は date 形式、description は NULL なら省略、順序は行順のまま。
// link の child 側は articles から外れて親の children に入り、子のない親も children は [] になる。hot は親にだけ出る
func TestToDigest(t *testing.T) {
	desc := "summary"
	d := db.Digest{ID: uuid.New(), EntryDate: time.Date(2026, 9, 22, 0, 0, 0, 0, time.UTC)}
	rows := []db.Article{
		{ID: uuid.New(), Category: "セキュリティ", Title: "a", Url: "https://a.example", Description: &desc},
		{ID: uuid.New(), Category: "セキュリティ", Title: "a-child", Url: "https://a.example/child"},
		{ID: uuid.New(), Category: "その他", Title: "b", Url: "https://b.example"},
		{ID: uuid.New(), Category: "IT系", Title: "c", Url: "https://c.example", IsHot: true},
		{ID: uuid.New(), Category: "IT系", Title: "c-child", Url: "https://c.example/child", IsHot: true},
	}
	links := []db.ArticleLink{{ParentID: rows[0].ID, ChildID: rows[1].ID}, {ParentID: rows[3].ID, ChildID: rows[4].ID}}
	body, err := json.Marshal(toDigest(d, rows, links))
	if err != nil {
		t.Fatal(err)
	}
	var got struct {
		EntryDate string `json:"entryDate"`
		Articles  []struct {
			Title       string
			Hot         bool
			Description any
			Children    []map[string]any
		}
	}
	if err := json.Unmarshal(body, &got); err != nil {
		t.Fatal(err)
	}
	if got.EntryDate != "2026-09-22" {
		t.Errorf("entryDate: got %q", got.EntryDate)
	}
	if len(got.Articles) != 3 || got.Articles[0].Title != "a" || got.Articles[1].Title != "b" || got.Articles[2].Title != "c" {
		t.Errorf("articles order: got %v", got.Articles)
	}
	if got.Articles[0].Description != "summary" {
		t.Errorf("description: got %v", got.Articles[0].Description)
	}
	if len(got.Articles[0].Children) != 1 || got.Articles[0].Children[0]["title"] != "a-child" {
		t.Errorf("children: got %v", got.Articles[0].Children)
	}
	if got.Articles[0].Hot || !got.Articles[2].Hot {
		t.Errorf("hot: got %s", body)
	}
	if _, ok := got.Articles[2].Children[0]["hot"]; ok {
		t.Errorf("child should not carry hot: got %s", body)
	}
	if got.Articles[1].Children == nil || len(got.Articles[1].Children) != 0 {
		t.Errorf("children of childless parent should be []: got %s", body)
	}
	if got.Articles[1].Description != nil {
		t.Errorf("nil description must be omitted: %v", got.Articles[1])
	}
}
