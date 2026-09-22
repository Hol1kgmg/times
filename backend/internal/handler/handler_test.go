package handler

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/Hol1kgmg/times/backend/internal/db"
	"github.com/google/uuid"
)

// DB 行 → API 応答の変換: 日付は date 形式、description は NULL なら省略、順序は行順のまま
func TestToDigest(t *testing.T) {
	desc := "summary"
	d := db.Digest{ID: uuid.New(), EntryDate: time.Date(2026, 9, 22, 0, 0, 0, 0, time.UTC)}
	rows := []db.Article{
		{ID: uuid.New(), Category: "セキュリティ", Title: "a", Url: "https://a.example", Description: &desc},
		{ID: uuid.New(), Category: "その他", Title: "b", Url: "https://b.example"},
	}
	body, err := json.Marshal(toDigest(d, rows))
	if err != nil {
		t.Fatal(err)
	}
	var got struct {
		EntryDate string `json:"entryDate"`
		Items     []map[string]any
	}
	if err := json.Unmarshal(body, &got); err != nil {
		t.Fatal(err)
	}
	if got.EntryDate != "2026-09-22" {
		t.Errorf("entryDate: got %q", got.EntryDate)
	}
	if len(got.Items) != 2 || got.Items[0]["title"] != "a" || got.Items[1]["title"] != "b" {
		t.Errorf("items order: got %v", got.Items)
	}
	if got.Items[0]["description"] != "summary" {
		t.Errorf("description: got %v", got.Items[0]["description"])
	}
	if _, ok := got.Items[1]["description"]; ok {
		t.Errorf("nil description must be omitted: %v", got.Items[1])
	}
}
