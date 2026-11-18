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
	// 孫を作る・親に親を付けるは親子の FK で落ちる
	parent := &pgconn.PgError{Code: pgerrcode.ForeignKeyViolation, ConstraintName: "articles_parent_id_parent_is_child_fkey"}
	if err := constraintViolation(parent); !errors.As(err, &e) || e.Status != 400 {
		t.Errorf("parent: got %v", err)
	}
	other := &pgconn.PgError{Code: pgerrcode.ConnectionFailure}
	if err := constraintViolation(other); errors.As(err, &e) || err != other {
		t.Errorf("other: got %v", err)
	}
}

// 登録済みの照合は関連記事の URL も対象にする。漏れると印が付かず DB の unique で汎用エラーになる
func TestURLsOfIncludesChildren(t *testing.T) {
	entries := []entry{
		{url: "https://a.example", children: []child{{title: "a-child", url: "https://a.example/child"}}},
		{url: "https://b.example"},
	}
	got := urlsOf(entries)
	want := []string{"https://a.example", "https://a.example/child", "https://b.example"}
	if !slices.Equal(got, want) {
		t.Errorf("got %v, want %v", got, want)
	}
}

// 再掲載は親も子も repostOf で見分け、タイトルを持たない参照として扱う
func TestEntriesOfTellsRepostFromNewArticle(t *testing.T) {
	var items []api.DigestEntry
	body := `[{"category":"その他","title":"t","url":"https://a.example","hot":true,"hidden":true},{"category":"IT系","repostOf":"https://b.example","children":[{"repostOf":"https://b.example/c","hot":true},{"title":"n","url":"https://b.example/n"}]}]`
	if err := json.Unmarshal([]byte(body), &items); err != nil {
		t.Fatal(err)
	}
	got, err := entriesOf(items)
	if err != nil {
		t.Fatal(err)
	}
	if got[0].repost || got[0].title != "t" || !got[0].hot || !got[0].hidden || !got[1].repost || got[1].url != "https://b.example" || got[1].category != api.CategoryIT {
		t.Errorf("got %+v", got)
	}
	if cs := got[1].children; !cs[0].repost || !cs[0].hot || cs[0].url != "https://b.example/c" || cs[1].repost || cs[1].title != "n" {
		t.Errorf("children: got %+v", cs)
	}
}

// placed は公開済みの Digest に元の掲載として載っている行
func placed(r db.ListArticlesByDigestRow) db.ListArticlesByDigestRow {
	published := "published"
	r.Placed, r.OriginalStatus = true, &published
	return r
}

// DB 行 → API 応答の変換: 日付は date 形式、description は NULL なら省略、順序は行 (position) 順のまま。
// parent_id を持つ行は親の children に行順で入り、子のない親も children は [] になる。hot は子も自分の値を出す
func TestToDigest(t *testing.T) {
	desc := "summary"
	d := db.Digest{ID: uuid.New(), EntryDate: time.Date(2026, 9, 22, 0, 0, 0, 0, time.UTC)}
	a, c := uuid.New(), uuid.New()
	rows := []db.ListArticlesByDigestRow{
		placed(db.ListArticlesByDigestRow{ID: a, Category: "セキュリティ", Title: "a", Url: "https://a.example", Description: &desc}),
		placed(db.ListArticlesByDigestRow{ID: uuid.New(), Category: "セキュリティ", Title: "a-child-1", Url: "https://a.example/1", ParentID: &a}),
		placed(db.ListArticlesByDigestRow{ID: uuid.New(), Category: "その他", Title: "b", Url: "https://b.example"}),
		// 子は親の直後とは限らず、別の枠の後ろに来ても親の下に入る
		placed(db.ListArticlesByDigestRow{ID: uuid.New(), Category: "UI系", Title: "a-child-2", Url: "https://a.example/2", ParentID: &a}),
		placed(db.ListArticlesByDigestRow{ID: c, Category: "IT系", Title: "c", Url: "https://c.example", IsHot: true}),
		placed(db.ListArticlesByDigestRow{ID: uuid.New(), Category: "IT系", Title: "c-child", Url: "https://c.example/child", ParentID: &c, IsHot: true}),
	}
	body, err := json.Marshal(toDigest(d, rows, false))
	if err != nil {
		t.Fatal(err)
	}
	var got struct {
		EntryDate string `json:"entryDate"`
		Articles  []struct {
			Title       string
			Category    string
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
	if len(got.Articles[0].Children) != 2 || got.Articles[0].Children[0]["title"] != "a-child-1" || got.Articles[0].Children[1]["title"] != "a-child-2" {
		t.Errorf("children: got %v", got.Articles[0].Children)
	}
	// 親の元の掲載は、子のカテゴリが違っても親のカテゴリで出す
	if got.Articles[0].Category != "セキュリティ" || got.Articles[0].Children[1]["category"] != "UI系" {
		t.Errorf("category: got %s", body)
	}
	if got.Articles[0].Hot || !got.Articles[2].Hot {
		t.Errorf("hot: got %s", body)
	}
	if got.Articles[2].Children[0]["hot"] != true || got.Articles[0].Children[0]["hot"] != false {
		t.Errorf("child hot: got %s", body)
	}
	if got.Articles[1].Children == nil || len(got.Articles[1].Children) != 0 {
		t.Errorf("children of childless parent should be []: got %s", body)
	}
	if got.Articles[1].Description != nil {
		t.Errorf("nil description must be omitted: %v", got.Articles[1])
	}
}

// 呼び出した親と再掲載の投稿は、子があれば最初の子のカテゴリで出し、初掲載日は親にだけ出す (specs/018 FR-010・FR-014)
func TestToDigestRepost(t *testing.T) {
	first := time.Date(2026, 10, 3, 0, 0, 0, 0, time.UTC)
	p, q := uuid.New(), uuid.New()
	summoned := placed(db.ListArticlesByDigestRow{ID: p, Category: "セキュリティ", Title: "p", Url: "https://p.example", IsRepost: true, FirstPublishedOn: &first})
	summoned.Placed = false
	rows := []db.ListArticlesByDigestRow{
		summoned,
		placed(db.ListArticlesByDigestRow{ID: uuid.New(), Category: "IT系", Title: "c", Url: "https://p.example/c", ParentID: &p, IsRepost: true}),
		placed(db.ListArticlesByDigestRow{ID: uuid.New(), Category: "AI系", Title: "d", Url: "https://p.example/d", ParentID: &p}),
		placed(db.ListArticlesByDigestRow{ID: q, Category: "セキュリティ", Title: "q", Url: "https://q.example", IsRepost: true, IsHot: true}),
	}
	body, err := json.Marshal(toDigest(db.Digest{ID: uuid.New()}, rows, false))
	if err != nil {
		t.Fatal(err)
	}
	var got struct {
		Articles []struct {
			Category         string
			OriginalCategory string
			Repost           bool
			Hot              bool
			FirstPublishedOn string
			Children         []map[string]any
		}
	}
	if err := json.Unmarshal(body, &got); err != nil {
		t.Fatal(err)
	}
	if got.Articles[0].Category != "IT系" || !got.Articles[0].Repost || got.Articles[0].FirstPublishedOn != "2026-10-03" || got.Articles[0].OriginalCategory != "セキュリティ" {
		t.Errorf("summoned parent: got %s", body)
	}
	if got.Articles[0].Children[0]["repost"] != true || got.Articles[0].Children[1]["repost"] != false {
		t.Errorf("repost child: got %s", body)
	}
	if got.Articles[1].Category != "セキュリティ" {
		t.Errorf("repost without children keeps the article category: got %s", body)
	}
	if got.Articles[1].Hot {
		t.Errorf("a placement that became a repost by a date change must not show its old HOT: got %s", body)
	}
	if _, ok := got.Articles[0].Children[0]["firstPublishedOn"]; ok {
		t.Errorf("child should not carry firstPublishedOn: got %s", body)
	}
}

// 公開ページでは表示しない記事の子を外し、親や子のない再掲載は「非公開記事」として中身を隠す。行き場のない元の掲載は出さない
func TestToDigestConcealsInvisibleArticles(t *testing.T) {
	private := "private"
	hiddenParent, privateParent, shown := uuid.New(), uuid.New(), uuid.New()
	hidden := placed(db.ListArticlesByDigestRow{ID: hiddenParent, Category: "IT系", Title: "hidden", Url: "https://h.example", Hidden: true})
	lonely := placed(db.ListArticlesByDigestRow{ID: uuid.New(), Category: "IT系", Title: "lonely", Url: "https://l.example", Hidden: true})
	summoned := placed(db.ListArticlesByDigestRow{ID: privateParent, Category: "IT系", Title: "secret", Url: "https://s.example", IsRepost: true})
	summoned.Placed, summoned.OriginalStatus = false, &private
	repost := placed(db.ListArticlesByDigestRow{ID: uuid.New(), Category: "その他", Title: "secret-repost", Url: "https://r.example", IsRepost: true})
	repost.OriginalStatus = &private
	privateChild := placed(db.ListArticlesByDigestRow{ID: uuid.New(), Category: "IT系", Title: "secret-child", Url: "https://v.example/x", ParentID: &shown, IsRepost: true})
	privateChild.OriginalStatus = &private
	rows := []db.ListArticlesByDigestRow{
		hidden,
		placed(db.ListArticlesByDigestRow{ID: uuid.New(), Category: "IT系", Title: "h-child", Url: "https://h.example/c", ParentID: &hiddenParent}),
		lonely,
		summoned,
		placed(db.ListArticlesByDigestRow{ID: uuid.New(), Category: "IT系", Title: "s-child", Url: "https://s.example/c", ParentID: &privateParent}),
		repost,
		placed(db.ListArticlesByDigestRow{ID: shown, Category: "IT系", Title: "shown", Url: "https://v.example"}),
		privateChild,
	}
	body, err := json.Marshal(toDigest(db.Digest{ID: uuid.New()}, rows, true))
	if err != nil {
		t.Fatal(err)
	}
	var got struct {
		Articles []struct {
			Title     *string
			Url       *string
			Concealed bool
			Children  []map[string]any
		}
	}
	if err := json.Unmarshal(body, &got); err != nil {
		t.Fatal(err)
	}
	a := got.Articles
	if len(a) != 4 {
		t.Fatalf("a hidden original without children must be left out: got %s", body)
	}
	for i := range 3 {
		if !a[i].Concealed || a[i].Title != nil || a[i].Url != nil {
			t.Errorf("article %d should be concealed: got %s", i, body)
		}
	}
	if len(a[0].Children) != 1 || len(a[1].Children) != 1 || len(a[2].Children) != 0 {
		t.Errorf("visible children stay under the concealed parent: got %s", body)
	}
	if a[3].Concealed || *a[3].Title != "shown" || len(a[3].Children) != 0 {
		t.Errorf("an invisible child must be left out: got %s", body)
	}
	// 編集画面には全部を中身ごと返す
	all := toDigest(db.Digest{ID: uuid.New()}, rows, false)
	if len(all.Articles) != 5 || all.Articles[0].Concealed != nil || len(all.Articles[4].Children) != 1 {
		t.Errorf("editor: got %+v", all.Articles)
	}
}

// 保存の振り分けは data-model.md の業務ルールの表の行ごと (specs/018 FR-005・FR-006・FR-008)
func TestCheckEntries(t *testing.T) {
	first := time.Date(2026, 10, 3, 0, 0, 0, 0, time.UTC)
	oldParent := "https://old.example"
	registered := map[string]db.ListRegisteredArticlesRow{
		"https://old.example":       {Url: "https://old.example", Title: "old", Category: "セキュリティ", FirstPublishedOn: &first},
		"https://old.example/child": {Url: "https://old.example/child", Category: "IT系", FirstPublishedOn: &first, ParentUrl: &oldParent},
		"https://draft.example":     {Url: "https://draft.example", Category: "その他"},
		"https://here.example":      {Url: "https://here.example", Category: "その他", Placed: true},
		"https://kept.example":      {Url: "https://kept.example", Category: "その他", Placed: true, HasEarlier: true},
	}
	newChild := []child{{title: "new", url: "https://new.example"}}
	repostChild := []child{{url: "https://old.example/child", repost: true}}
	tests := []struct {
		name     string
		entries  []entry
		wantType string
	}{
		{"registered url as a child", []entry{{url: "https://new.example", children: []child{{url: "https://old.example"}}}}, "/problems/url-already-registered"},
		{"registered parent without an earlier published placement", []entry{{url: "https://draft.example"}}, "/problems/url-already-registered"},
		{"repost of an unknown article", []entry{{url: "https://none.example", repost: true, category: api.CategoryOther}}, "/problems/repost-unavailable"},
		{"repost of an article only on drafts", []entry{{url: "https://draft.example", repost: true, category: api.CategoryOther}}, "/problems/repost-unavailable"},
		{"repost without children changing the category", []entry{{url: "https://old.example", repost: true, category: api.CategoryIT}}, "/problems/validation-failed"},
		{"repost with a child in another category", []entry{{url: "https://old.example", repost: true, category: api.CategoryIT, children: newChild}}, ""},
		{"repost without children", []entry{{url: "https://old.example", repost: true, category: api.CategorySecurity}}, ""},
		{"article already in this digest", []entry{{url: "https://here.example", title: "edited"}}, ""},
		{"repost already in this digest whose original was made private", []entry{{url: "https://kept.example", repost: true, category: api.CategoryOther}}, ""},
		{"original in this digest sent as a repost stays the original", []entry{{url: "https://here.example", repost: true, category: api.CategoryOther}}, ""},
		{"article in this digest with an earlier placement sent as an ordinary parent", []entry{{url: "https://kept.example", title: "again"}}, "/problems/url-already-registered"},
		{"repost in this digest sent as a child", []entry{{url: "https://new.example", children: []child{{url: "https://kept.example"}}}}, "/problems/url-already-registered"},
		{"repost child under its own parent", []entry{{url: "https://old.example", repost: true, category: api.CategoryIT, children: repostChild}}, ""},
		{"repost child under another parent", []entry{{url: "https://new.example", children: repostChild}}, "/problems/validation-failed"},
		{"repost child that never had a parent", []entry{{url: "https://new.example", children: []child{{url: "https://kept.example", repost: true}}}}, "/problems/validation-failed"},
		// 単独で載せても、読むときに記事の親を呼び出して下に入れる
		{"repost of a child on its own", []entry{{url: "https://old.example/child", repost: true, category: api.CategoryIT}}, ""},
		{"repost child of an article only on drafts", []entry{{url: "https://new.example", children: []child{{url: "https://draft.example", repost: true}}}}, "/problems/repost-unavailable"},
	}
	for _, tt := range tests {
		err := checkEntries(tt.entries, registered)
		var e *apperr.Error
		got := ""
		if errors.As(err, &e) {
			got = e.Type
		}
		if got != tt.wantType {
			t.Errorf("%s: got %v, want %q", tt.name, err, tt.wantType)
		}
	}
}

// 再掲載にできる親は、画面が行を切り替えられるよう元の記事ごと返す
func TestCheckEntriesReturnsRepostable(t *testing.T) {
	first := time.Date(2026, 10, 3, 0, 0, 0, 0, time.UTC)
	registered := map[string]db.ListRegisteredArticlesRow{
		"https://old.example":   {Url: "https://old.example", Title: "old", Category: "セキュリティ", FirstPublishedOn: &first},
		"https://draft.example": {Url: "https://draft.example", Category: "その他"},
	}
	err := checkEntries([]entry{{url: "https://old.example", title: "typed"}, {url: "https://draft.example"}}, registered)
	var e *apperr.Error
	if !errors.As(err, &e) || len(e.DuplicateURLs) != 2 || len(e.Repostable) != 1 || e.Repostable[0].Title != "old" || !e.Repostable[0].FirstPublishedOn.Equal(first) {
		t.Errorf("got %+v", err)
	}
}

// 今日 (JST) より後の日付だけ公開できない。境目は JST の 0 時で、下書きは日付を問わない (specs/010 FR-006)
func TestPublishable(t *testing.T) {
	date := func(day int) time.Time { return time.Date(2026, 11, day, 0, 0, 0, 0, time.UTC) }
	beforeMidnight := time.Date(2026, 11, 3, 14, 59, 0, 0, time.UTC) // JST 11-03 23:59
	midnight := time.Date(2026, 11, 3, 15, 0, 0, 0, time.UTC)        // JST 11-04 00:00
	tests := []struct {
		name   string
		status string
		date   time.Time
		now    time.Time
		want   bool
	}{
		{"today before midnight", "published", date(3), beforeMidnight, true},
		{"tomorrow before midnight", "published", date(4), beforeMidnight, false},
		{"tomorrow after midnight", "published", date(4), midnight, true},
		{"draft dated tomorrow", "draft", date(4), beforeMidnight, true},
	}
	for _, tt := range tests {
		if got := publishable(db.Digest{Status: tt.status, EntryDate: tt.date}, tt.now); got != tt.want {
			t.Errorf("%s: got %v, want %v", tt.name, got, tt.want)
		}
	}
}
