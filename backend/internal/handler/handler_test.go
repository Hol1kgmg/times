package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/Hol1kgmg/times/backend/internal/apperr"
	"github.com/Hol1kgmg/times/backend/internal/db"
	"github.com/google/uuid"
	"github.com/jackc/pgerrcode"
	"github.com/jackc/pgx/v5/pgconn"
)

// unique / check 違反は 400、それ以外の DB エラーはそのまま (500 になる)
func TestConstraintViolation(t *testing.T) {
	unique := &pgconn.PgError{Code: pgerrcode.UniqueViolation, ConstraintName: "articles_digest_id_url_key"}
	var e *apperr.Error
	if err := constraintViolation(fmt.Errorf("wrap: %w", unique)); !errors.As(err, &e) || e.Status != 400 {
		t.Errorf("unique: got %v", err)
	}
	other := &pgconn.PgError{Code: pgerrcode.ConnectionFailure}
	if err := constraintViolation(other); errors.As(err, &e) || err != other {
		t.Errorf("other: got %v", err)
	}
}

// DB 行 → API 応答の変換: 日付は date 形式、description は NULL なら省略、順序は行順のまま。
// link の child 側は items から外れて親の children に入り、子のない親も children は [] になる
func TestToDigest(t *testing.T) {
	desc := "summary"
	d := db.Digest{ID: uuid.New(), EntryDate: time.Date(2026, 9, 22, 0, 0, 0, 0, time.UTC)}
	rows := []db.Article{
		{ID: uuid.New(), Category: "セキュリティ", Title: "a", Url: "https://a.example", Description: &desc},
		{ID: uuid.New(), Category: "セキュリティ", Title: "a-child", Url: "https://a.example/child"},
		{ID: uuid.New(), Category: "その他", Title: "b", Url: "https://b.example"},
	}
	links := []db.ArticleLink{{ParentID: rows[0].ID, ChildID: rows[1].ID}}
	body, err := json.Marshal(toDigest(d, rows, links))
	if err != nil {
		t.Fatal(err)
	}
	var got struct {
		EntryDate string `json:"entryDate"`
		Items     []struct {
			Title       string
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
	if len(got.Items) != 2 || got.Items[0].Title != "a" || got.Items[1].Title != "b" {
		t.Errorf("items order: got %v", got.Items)
	}
	if got.Items[0].Description != "summary" {
		t.Errorf("description: got %v", got.Items[0].Description)
	}
	if len(got.Items[0].Children) != 1 || got.Items[0].Children[0]["title"] != "a-child" {
		t.Errorf("children: got %v", got.Items[0].Children)
	}
	if got.Items[1].Children == nil || len(got.Items[1].Children) != 0 {
		t.Errorf("children of childless parent should be []: got %s", body)
	}
	if got.Items[1].Description != nil {
		t.Errorf("nil description must be omitted: %v", got.Items[1])
	}
}
