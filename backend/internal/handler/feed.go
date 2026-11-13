package handler

import (
	"bytes"
	"context"
	"encoding/xml"
	"errors"
	"fmt"
	"time"

	"github.com/Hol1kgmg/times/backend/internal/api"
	"github.com/Hol1kgmg/times/backend/internal/apperr"
	"github.com/Hol1kgmg/times/backend/internal/db"
	"github.com/Hol1kgmg/times/backend/internal/feed"
	"github.com/jackc/pgx/v5"
)

// frontend の shared/config/site.ts と同じ値。リクエストの host から組み立てない
const siteURL = "https://z-times.dev"

// 画像のデザインを変えたら上げる。リーダーや SNS に残った古い画像の URL を切り替えるため
const imageVersion = 1

func (s *Server) GetFeed(ctx context.Context, _ api.GetFeedRequestObject) (api.GetFeedResponseObject, error) {
	rows, err := s.q.ListFeedDigests(ctx, s.adminLogin)
	if err != nil {
		return nil, err
	}
	body, err := toRSS(rows)
	if err != nil {
		return nil, err
	}
	return api.GetFeed200ApplicationrssXmlResponse{Body: bytes.NewReader(body), ContentLength: int64(len(body))}, nil
}

func (s *Server) GetFeedImage(ctx context.Context, req api.GetFeedImageRequestObject) (api.GetFeedImageResponseObject, error) {
	_, err := s.q.GetFeedDigestByDate(ctx, db.GetFeedDigestByDateParams{AdminLogin: s.adminLogin, EntryDate: req.EntryDate.Time})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.NotFound("no feed entry for the entry date")
	}
	if err != nil {
		return nil, err
	}
	img, err := feed.Render(formatEntryDate(req.EntryDate.Time))
	if err != nil {
		return nil, err
	}
	return api.GetFeedImage200ImagepngResponse{Body: bytes.NewReader(img), ContentLength: int64(len(img))}, nil
}

// サイトの日付の形 (shared/lib/entry-date の formatEntryDateWithoutYear) と揃える。date 型は UTC の 0 時で届く
func formatEntryDate(t time.Time) string {
	t = t.UTC()
	return fmt.Sprintf("%d月%d日(%c)", t.Month(), t.Day(), []rune("日月火水木金土")[t.Weekday()])
}

// encoding/xml は名前空間の接頭辞を出せないので、atom: / media: は名前に直接書く
type rss struct {
	XMLName xml.Name   `xml:"rss"`
	Version string     `xml:"version,attr"`
	Atom    string     `xml:"xmlns:atom,attr"`
	Media   string     `xml:"xmlns:media,attr"`
	Channel rssChannel `xml:"channel"`
}

type rssChannel struct {
	Title       string    `xml:"title"`
	Link        string    `xml:"link"`
	Description string    `xml:"description"`
	Language    string    `xml:"language"`
	Self        atomLink  `xml:"atom:link"`
	Items       []rssItem `xml:"item"`
}

type atomLink struct {
	Href string `xml:"href,attr"`
	Rel  string `xml:"rel,attr"`
	Type string `xml:"type,attr"`
}

type rssItem struct {
	Title       string       `xml:"title"`
	Link        string       `xml:"link"`
	GUID        rssGUID      `xml:"guid"`
	PubDate     string       `xml:"pubDate"`
	Description cdata        `xml:"description"`
	Media       mediaContent `xml:"media:content"`
}

type rssGUID struct {
	IsPermaLink bool   `xml:"isPermaLink,attr"`
	Value       string `xml:",chardata"`
}

type cdata struct {
	Value string `xml:",cdata"`
}

type mediaContent struct {
	URL    string `xml:"url,attr"`
	Type   string `xml:"type,attr"`
	Medium string `xml:"medium,attr"`
	Width  int    `xml:"width,attr"`
	Height int    `xml:"height,attr"`
}

func toRSS(rows []db.ListFeedDigestsRow) ([]byte, error) {
	items := make([]rssItem, 0, len(rows))
	for _, r := range rows {
		date := r.EntryDate.UTC().Format(time.DateOnly)
		label := formatEntryDate(r.EntryDate)
		img := fmt.Sprintf("%s/feed/images/%s.png?v=%d", siteURL, date, imageVersion)
		items = append(items, rssItem{
			Title: label + "の times 投稿が公開されました",
			Link:  siteURL + "/digest/" + date,
			// 日付は変えられるので、Digest の ID で同じ通知を指す
			GUID:        rssGUID{Value: "urn:uuid:" + r.ID.String()},
			PubDate:     r.PublishedAt.In(jst).Format(time.RFC1123Z),
			Description: cdata{fmt.Sprintf(`<img src="%s" alt="%s" width="1200" height="630">`, img, label)},
			Media:       mediaContent{URL: img, Type: "image/png", Medium: "image", Width: 1200, Height: 630},
		})
	}
	body, err := xml.Marshal(rss{
		Version: "2.0",
		Atom:    "http://www.w3.org/2005/Atom",
		Media:   "http://search.yahoo.com/mrss/",
		Channel: rssChannel{
			Title:       "z_times.dev",
			Link:        siteURL + "/",
			Description: "見かけて気になった技術や趣味の記事を、日ごとにゆるくまとめてます。",
			Language:    "ja",
			Self:        atomLink{Href: siteURL + "/feed.xml", Rel: "self", Type: "application/rss+xml"},
			Items:       items,
		},
	})
	if err != nil {
		return nil, err
	}
	return append([]byte(xml.Header), body...), nil
}
