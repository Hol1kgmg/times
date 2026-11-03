package handler

import (
	"encoding/xml"
	"testing"
	"time"

	"github.com/Hol1kgmg/times/backend/internal/db"
	"github.com/google/uuid"
)

// 通知は公開時刻の新しい順のまま並び、題名はサイトの日付の形、guid は Digest ごとに固定、画像 URL は版付き (specs/010 FR-003/004/009)
func TestToRSS(t *testing.T) {
	rows := []db.ListFeedDigestsRow{
		{ID: uuid.New(), EntryDate: time.Date(2026, 10, 20, 0, 0, 0, 0, time.UTC), PublishedAt: time.Date(2026, 11, 3, 12, 4, 5, 0, time.UTC)},
		{ID: uuid.New(), EntryDate: time.Date(2026, 10, 30, 0, 0, 0, 0, time.UTC), PublishedAt: time.Date(2026, 11, 2, 12, 0, 0, 0, time.UTC)},
	}
	body, err := toRSS(rows)
	if err != nil {
		t.Fatal(err)
	}
	var got struct {
		Items []struct {
			Title   string `xml:"title"`
			Link    string `xml:"link"`
			GUID    string `xml:"guid"`
			PubDate string `xml:"pubDate"`
			Media   struct {
				URL string `xml:"url,attr"`
			} `xml:"http://search.yahoo.com/mrss/ content"`
		} `xml:"channel>item"`
	}
	if err := xml.Unmarshal(body, &got); err != nil {
		t.Fatalf("%v: %s", err, body)
	}
	if len(got.Items) != 2 || got.Items[1].Link != "https://z-times.dev/digest/2026-10-30" {
		t.Fatalf("items: %s", body)
	}
	first := got.Items[0]
	if first.Title != "10月20日(火)の times 投稿が公開されました" {
		t.Errorf("title: got %q", first.Title)
	}
	if first.Link != "https://z-times.dev/digest/2026-10-20" {
		t.Errorf("link: got %q", first.Link)
	}
	if first.GUID != "urn:uuid:"+rows[0].ID.String() {
		t.Errorf("guid: got %q", first.GUID)
	}
	if first.PubDate != "Tue, 03 Nov 2026 21:04:05 +0900" {
		t.Errorf("pubDate: got %q", first.PubDate)
	}
	if first.Media.URL != "https://z-times.dev/feed/images/2026-10-20.png?v=1" {
		t.Errorf("image: got %q", first.Media.URL)
	}
}
