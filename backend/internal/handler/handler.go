// Package handler は oapi-codegen の StrictServerInterface を実装する。
// ponytail: usecase / repository 層なし。handler が sqlc の Queries を直接呼ぶ。増えたら切る。
package handler

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"time"

	"github.com/Hol1kgmg/times/backend/internal/api"
	"github.com/Hol1kgmg/times/backend/internal/apperr"
	"github.com/Hol1kgmg/times/backend/internal/auth"
	"github.com/Hol1kgmg/times/backend/internal/db"
	"github.com/google/uuid"
	"github.com/jackc/pgerrcode"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

type Server struct {
	pool  *pgxpool.Pool
	q     *db.Queries
	authq authQueries
	gh    auth.Client
	// adminLogin は許可する GitHub ユーザー名。大文字小文字を区別しない (specs/003 FR-011)
	adminLogin string
	// authConfigured が false なら POST /auth/sessions は常に 403 (specs/003 FR-012)
	authConfigured bool
}

var _ api.StrictServerInterface = (*Server)(nil)

func New(pool *pgxpool.Pool, gh auth.Client, adminLogin string) *Server {
	q := db.New(pool)
	return &Server{
		pool: pool, q: q, authq: q, gh: gh, adminLogin: adminLogin,
		authConfigured: gh.ClientID != "" && gh.ClientSecret != "" && adminLogin != "",
	}
}

func (s *Server) GetHealth(context.Context, api.GetHealthRequestObject) (api.GetHealthResponseObject, error) {
	return api.GetHealth200JSONResponse{Status: "ok"}, nil
}

func (s *Server) GetLatestDigest(ctx context.Context, _ api.GetLatestDigestRequestObject) (api.GetLatestDigestResponseObject, error) {
	d, err := s.q.GetLatestDigest(ctx)
	if errors.Is(err, pgx.ErrNoRows) {
		// DB の意味を知っているのは handler。配線層で pgx を見ない (adr/backend/0002)
		return nil, apperr.NotFound("no digest registered")
	}
	if err != nil {
		return nil, err
	}
	out, err := s.withArticles(ctx, d, true)
	if err != nil {
		return nil, err
	}
	return api.GetLatestDigest200JSONResponse(out), nil
}

func (s *Server) ListPublishedDigests(ctx context.Context, req api.ListPublishedDigestsRequestObject) (api.ListPublishedDigestsResponseObject, error) {
	// openapi.yaml の default は oapi-codegen が埋めないので、同じ値をここで使う
	lim := 7
	if req.Params.Limit != nil {
		lim = *req.Params.Limit
	}
	var before *time.Time
	if req.Params.Before != nil {
		before = &req.Params.Before.Time
	}
	rows, err := s.q.ListPublishedDigests(ctx, db.ListPublishedDigestsParams{AdminLogin: s.adminLogin, Before: before, Lim: int32(lim)})
	if err != nil {
		return nil, err
	}
	// ponytail: Digest ごとに記事を引く (最大 1 + 31×2 クエリ)。遅くなったら ANY でまとめて引いて振り分ける
	digests := make([]api.Digest, 0, len(rows))
	for _, d := range rows {
		out, err := s.withArticles(ctx, d, true)
		if err != nil {
			return nil, err
		}
		digests = append(digests, out)
	}
	return api.ListPublishedDigests200JSONResponse{Digests: digests}, nil
}

func (s *Server) ListDigests(ctx context.Context, _ api.ListDigestsRequestObject) (api.ListDigestsResponseObject, error) {
	rows, err := s.q.ListDigests(ctx)
	if err != nil {
		return nil, err
	}
	digests := make([]api.DigestSummary, 0, len(rows))
	for _, r := range rows {
		digests = append(digests, api.DigestSummary{Id: r.ID, EntryDate: openapi_types.Date{Time: r.EntryDate}, Status: api.DigestStatus(r.Status)})
	}
	return api.ListDigests200JSONResponse{Digests: digests}, nil
}

func (s *Server) ListArticleDomains(ctx context.Context, req api.ListArticleDomainsRequestObject) (api.ListArticleDomainsResponseObject, error) {
	domains, err := s.articleDomains(ctx, req.Params.Q, req.Params.Limit, true)
	if err != nil {
		return nil, err
	}
	return api.ListArticleDomains200JSONResponse{Domains: domains}, nil
}

// ponytail: ログインできるのは管理者だけなので bearerAuth で足りる。一般ユーザーを足したら管理者の判定を足す
func (s *Server) ListAllArticleDomains(ctx context.Context, req api.ListAllArticleDomainsRequestObject) (api.ListAllArticleDomainsResponseObject, error) {
	domains, err := s.articleDomains(ctx, req.Params.Q, req.Params.Limit, false)
	if err != nil {
		return nil, err
	}
	return api.ListAllArticleDomains200JSONResponse{Domains: domains}, nil
}

// ponytail: ログインできるのは管理者だけなので bearerAuth で足りる。一般ユーザーを足したら管理者の判定を足す
func (s *Server) SearchArticles(ctx context.Context, req api.SearchArticlesRequestObject) (api.SearchArticlesResponseObject, error) {
	p, ok := auth.PrincipalFrom(ctx)
	if !ok {
		return nil, apperr.Unauthorized("no session in context")
	}
	rows, err := s.q.SearchArticles(ctx, db.SearchArticlesParams{CreatedBy: p.UserID, Q: req.Params.Q, EncodedQ: encodedQuery(req.Params.Q)})
	if err != nil {
		return nil, err
	}
	hits := make([]api.ArticleSearchHit, 0, len(rows))
	for _, r := range rows {
		first, reposted := splitPublishedOn(r.PublishedOn)
		hits = append(hits, api.ArticleSearchHit{Id: r.ID, Url: r.Url, Title: r.Title, Category: api.Category(r.Category),
			Parent: toSearchParent(r.ParentUrl, r.ParentTitle), FirstPublishedOn: first, RepostedOn: reposted, HotOn: toDates(r.HotOn)})
	}
	return api.SearchArticles200JSONResponse{Articles: hits}, nil
}

// ponytail: ログインできるのは管理者だけなので bearerAuth で足りる。一般ユーザーを足したら管理者の判定を足す
func (s *Server) ListRepostCandidates(ctx context.Context, req api.ListRepostCandidatesRequestObject) (api.ListRepostCandidatesResponseObject, error) {
	p, ok := auth.PrincipalFrom(ctx)
	if !ok {
		return nil, apperr.Unauthorized("no session in context")
	}
	rows, err := s.q.ListRepostCandidates(ctx, db.ListRepostCandidatesParams{CreatedBy: p.UserID, Q: req.Params.Q, EncodedQ: encodedQuery(req.Params.Q)})
	if err != nil {
		return nil, err
	}
	candidates := make([]api.RepostCandidate, 0, len(rows))
	for _, r := range rows {
		candidates = append(candidates, api.RepostCandidate{Id: r.ID, Url: r.Url, Title: r.Title, Category: api.Category(r.Category),
			Parent: toSearchParent(r.ParentUrl, r.ParentTitle), FirstPublishedOn: openapi_types.Date{Time: r.FirstPublishedOn}})
	}
	return api.ListRepostCandidates200JSONResponse{Articles: candidates}, nil
}

func toSearchParent(url, title *string) *api.ArticleSearchParent {
	// url と title は同じ LEFT JOIN の行から来るので、片方だけ入ることはない
	if url == nil || title == nil {
		return nil
	}
	return &api.ArticleSearchParent{Url: *url, Title: *title}
}

// 公開の掲載を INNER JOIN して古い順に集めるので、dates は 1 件以上ある
func splitPublishedOn(dates []time.Time) (openapi_types.Date, []openapi_types.Date) {
	return openapi_types.Date{Time: dates[0]}, toDates(dates[1:])
}

func toDates(dates []time.Time) []openapi_types.Date {
	out := make([]openapi_types.Date, 0, len(dates))
	for _, d := range dates {
		out = append(out, openapi_types.Date{Time: d})
	}
	return out
}

// 保存した URL はパーセントエンコードされているので、ブラウザのアドレス欄から貼った日本語の URL でも当たるようにする
func encodedQuery(q string) string {
	u, err := url.Parse(q)
	if err != nil {
		return q
	}
	return u.String()
}

func (s *Server) articleDomains(ctx context.Context, q *string, limit *int, publishedOnly bool) ([]api.DomainCount, error) {
	// openapi.yaml の default は oapi-codegen が埋めないので、同じ値をここで使う
	lim := 20
	if limit != nil {
		lim = *limit
	}
	rows, err := s.q.ListArticleDomains(ctx, db.ListArticleDomainsParams{PublishedOnly: publishedOnly, Q: q, Lim: int32(lim)})
	if err != nil {
		return nil, err
	}
	domains := make([]api.DomainCount, 0, len(rows))
	for _, r := range rows {
		domains = append(domains, api.DomainCount{Host: r.Host, Count: int(r.Count)})
	}
	return domains, nil
}

func (s *Server) GetDigestByDate(ctx context.Context, req api.GetDigestByDateRequestObject) (api.GetDigestByDateResponseObject, error) {
	d, err := s.q.GetDigestByDate(ctx, req.EntryDate.Time)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.NotFound("no digest for the entry date")
	}
	if err != nil {
		return nil, err
	}
	// 編集画面が読むので、表示しない記事も中身ごと返す
	out, err := s.withArticles(ctx, d, false)
	if err != nil {
		return nil, err
	}
	return api.GetDigestByDate200JSONResponse(out), nil
}

func (s *Server) withArticles(ctx context.Context, d db.Digest, public bool) (api.Digest, error) {
	rows, err := s.q.ListArticlesByDigest(ctx, d.ID)
	if err != nil {
		return api.Digest{}, err
	}
	return toDigest(d, rows, public), nil
}

func (s *Server) UpdateDigest(ctx context.Context, req api.UpdateDigestRequestObject) (api.UpdateDigestResponseObject, error) {
	p, ok := auth.PrincipalFrom(ctx)
	if !ok {
		return nil, apperr.Unauthorized("no session in context")
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	q := s.q.WithTx(tx)
	if err := q.LockDigestDates(ctx); err != nil {
		return nil, err
	}
	before, err := q.GetDigestByDate(ctx, req.EntryDate.Time)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.NotFound("no digest for the entry date")
	}
	if err != nil {
		return nil, err
	}
	d, err := q.UpdateDigest(ctx, db.UpdateDigestParams{NewDate: req.Body.EntryDate.Time, Status: (*string)(req.Body.Status), CreatedBy: p.UserID, OldDate: req.EntryDate.Time})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.NotFound("no digest for the entry date")
	}
	if err != nil {
		return nil, constraintViolation(err)
	}
	if !publishable(d, time.Now()) {
		return nil, apperr.FuturePublish("cannot publish a digest dated after today (JST)")
	}
	publishing := d.Status == string(api.DigestStatusPublished) && before.Status != d.Status
	rows, err := saveArticles(ctx, q, d, p.UserID, req.Body.Articles, publishing)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return api.UpdateDigest200JSONResponse(toDigest(d, rows, false)), nil
}

// digest と articles を 1 トランザクションで入れる。途中で失敗したら digest も残さない
func (s *Server) CreateDigest(ctx context.Context, req api.CreateDigestRequestObject) (api.CreateDigestResponseObject, error) {
	p, ok := auth.PrincipalFrom(ctx)
	if !ok {
		return nil, apperr.Unauthorized("no session in context")
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	q := s.q.WithTx(tx)
	if err := q.LockDigestDates(ctx); err != nil {
		return nil, err
	}
	// 日付がぶつかるならリクエスト全体が成り立たないので、URL より先に確かめる
	status := api.NewDigestStatusDraft
	if req.Body.Status != nil {
		status = *req.Body.Status
	}
	d, err := q.CreateDigest(ctx, db.CreateDigestParams{EntryDate: req.Body.EntryDate.Time, CreatedBy: p.UserID, Status: string(status)})
	if err != nil {
		return nil, constraintViolation(err)
	}
	if !publishable(d, time.Now()) {
		return nil, apperr.FuturePublish("cannot publish a digest dated after today (JST)")
	}
	rows, err := saveArticles(ctx, q, d, p.UserID, req.Body.Articles, d.Status == string(api.DigestStatusPublished))
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return api.CreateDigest201JSONResponse(toDigest(d, rows, false)), nil
}

// entry は送られた親 1 件。再掲載は記事を参照するだけなので title を持たない
type entry struct {
	url, title                  string
	category                    api.Category
	hot, hidden, repost, listed bool
	children                    []child
}

// 子付きの再掲載は、親も載せる指定がなければ子のために親を呼び出すだけで、親を載せない
func (e entry) placed() bool { return !e.repost || e.listed || len(e.children) == 0 }

type child struct {
	url, title  string
	hot, repost bool
}

// OpenAPI の oneOf の検証で一方の形にだけ当たっているので、repostOf の有無で見分けてよい
func entriesOf(items []api.DigestEntry) ([]entry, error) {
	out := make([]entry, 0, len(items))
	for _, item := range items {
		r, err := item.AsRepostArticle()
		if err != nil {
			return nil, err
		}
		if r.RepostOf != "" {
			cs, err := childrenOf(deref(r.Children))
			if err != nil {
				return nil, err
			}
			out = append(out, entry{url: r.RepostOf, category: r.Category, repost: true, listed: isTrue(r.Listed), children: cs})
			continue
		}
		a, err := item.AsNewArticle()
		if err != nil {
			return nil, err
		}
		cs, err := childrenOf(deref(a.Children))
		if err != nil {
			return nil, err
		}
		out = append(out, entry{url: a.Url, title: a.Title, category: a.Category, hot: isTrue(a.Hot), hidden: isTrue(a.Hidden), children: cs})
	}
	return out, nil
}

func childrenOf(items []api.ChildEntry) ([]child, error) {
	out := make([]child, 0, len(items))
	for _, item := range items {
		r, err := item.AsRepostChildArticle()
		if err != nil {
			return nil, err
		}
		if r.RepostOf != "" {
			out = append(out, child{url: r.RepostOf, hot: isTrue(r.Hot), repost: true})
			continue
		}
		c, err := item.AsNewChildArticle()
		if err != nil {
			return nil, err
		}
		out = append(out, child{url: c.Url, title: c.Title, hot: isTrue(c.Hot)})
	}
	return out, nil
}

func isTrue(p *bool) bool { return p != nil && *p }

func deref[T any](p *[]T) []T {
	if p == nil {
		return nil
	}
	return *p
}

func saveArticles(ctx context.Context, q *db.Queries, d db.Digest, userID int64, items []api.DigestEntry, publishing bool) ([]db.ListArticlesByDigestRow, error) {
	entries, err := entriesOf(items)
	if err != nil {
		return nil, err
	}
	rows, err := q.ListRegisteredArticles(ctx, db.ListRegisteredArticlesParams{DigestID: d.ID, CreatedBy: userID, Urls: urlsOf(entries)})
	if err != nil {
		return nil, err
	}
	registered := make(map[string]db.ListRegisteredArticlesRow, len(rows))
	for _, r := range rows {
		registered[r.Url] = r
	}
	if err := checkEntries(entries, registered); err != nil {
		return nil, err
	}
	if err := q.ClearParents(ctx, db.ClearParentsParams{CreatedBy: userID, Urls: originalURLs(entries)}); err != nil {
		return nil, err
	}
	// 掲載は id を持たず外から参照されないので、消して入れ直せば並べ替えで position がぶつからない
	removed, err := q.DeleteDigestArticles(ctx, d.ID)
	if err != nil {
		return nil, err
	}
	var pos int32
	place := func(articleID uuid.UUID, hot bool) error {
		err := q.CreateDigestArticle(ctx, db.CreateDigestArticleParams{DigestID: d.ID, ArticleID: articleID, Position: pos, IsHot: hot})
		pos++
		return constraintViolation(err)
	}
	upsert := func(category api.Category, title, url string, parent *uuid.UUID, hidden bool) (uuid.UUID, error) {
		row, err := q.UpsertArticle(ctx, db.UpsertArticleParams{Category: string(category), Title: title, Url: url, CreatedBy: userID, ParentID: parent, Hidden: hidden})
		return row.ID, constraintViolation(err)
	}
	for _, e := range entries {
		id := registered[e.url].ID
		if !e.repost {
			if id, err = upsert(e.category, e.title, e.url, nil, e.hidden); err != nil {
				return nil, err
			}
		}
		if e.placed() {
			if err := place(id, e.hot); err != nil {
				return nil, err
			}
		}
		for _, c := range e.children {
			cid := registered[c.url].ID
			if !c.repost {
				if cid, err = upsert(e.category, c.title, c.url, &id, false); err != nil {
					return nil, err
				}
			}
			// 親が HOT なら子も HOT として持ち、親 HOT・子は HOT でない組み合わせを作らない (specs/018 FR-016)
			if err := place(cid, e.hot || c.hot); err != nil {
				return nil, err
			}
		}
	}
	stranded, err := q.ListStrandedParents(ctx, removed)
	if err != nil {
		return nil, err
	}
	if len(stranded) > 0 {
		parents := make([]apperr.Hideable, len(stranded))
		for i, r := range stranded {
			parents[i] = apperr.Hideable{URL: r.Url, Title: r.Title, Category: r.Category}
		}
		return nil, apperr.ParentHasChildren(parents)
	}
	if err := q.DeleteOrphanArticles(ctx, removed); err != nil {
		return nil, err
	}
	if publishing {
		if err := q.UnhideOriginals(ctx, d.ID); err != nil {
			return nil, err
		}
	}
	return q.ListArticlesByDigest(ctx, d.ID)
}

// 前の掲載がある記事を普通の親・子で通すと、再掲載で記事を書き換えられる。表は data-model.md の業務ルール
func checkEntries(entries []entry, registered map[string]db.ListRegisteredArticlesRow) error {
	var duplicates, unavailable []string
	var repostable []apperr.Repostable
	var invalid []string
	// 新しい記事と、この Digest が元の掲載の記事だけが、タイトル・カテゴリ・親を書き換えてよい
	original := func(url string) bool {
		r, ok := registered[url]
		return !ok || r.Placed && !r.HasEarlier
	}
	// この Digest に載っている記事は FR-005 を確かめ直さない (specs/018 FR-009)
	repostAvailable := func(url string) bool {
		r, ok := registered[url]
		return ok && (r.Placed || r.FirstPublishedOn != nil)
	}
	for _, e := range entries {
		for _, c := range e.children {
			r := registered[c.url]
			switch {
			case !c.repost && !original(c.url):
				duplicates = append(duplicates, c.url)
			case c.repost && !repostAvailable(c.url):
				unavailable = append(unavailable, c.url)
			// 再掲載は親を書き換えないので、記事の親の下でしか送れない
			case c.repost && (r.ParentUrl == nil || *r.ParentUrl != e.url):
				invalid = append(invalid, c.url)
			}
		}
		r := registered[e.url]
		switch {
		case e.repost && !repostAvailable(e.url) && !r.HasPlacedChild:
			unavailable = append(unavailable, e.url)
		case !e.repost && !original(e.url):
			duplicates = append(duplicates, e.url)
			if r.FirstPublishedOn != nil {
				repostable = append(repostable, apperr.Repostable{URL: r.Url, Title: r.Title, Category: r.Category, FirstPublishedOn: *r.FirstPublishedOn})
			}
		}
	}
	switch {
	case len(duplicates) > 0:
		return apperr.URLAlreadyRegistered(duplicates, repostable)
	case len(unavailable) > 0:
		return apperr.RepostUnavailable(unavailable)
	case len(invalid) > 0:
		return apperr.ValidationFailed(fmt.Sprintf("%d reposts must keep the parent of the article", len(invalid)))
	}
	return nil
}

var jst = time.FixedZone("JST", 9*60*60)

// 書き込み後の行で見るので、status の省略 (今のまま) や日付だけの変更でも同じく断れる。今日は JST で決める (specs/010 FR-006)
func publishable(d db.Digest, now time.Time) bool {
	today, _ := time.Parse(time.DateOnly, now.In(jst).Format(time.DateOnly))
	return d.Status != "published" || !d.EntryDate.After(today)
}

// 登録済みの日付・URL (unique)、空文字 (check)、親子の形 (FK) は入力の誤りなので 400 にする
func constraintViolation(err error) error {
	var pg *pgconn.PgError
	if errors.As(err, &pg) && pg.ConstraintName == "digests_created_by_entry_date_key" {
		return apperr.DigestAlreadyExists("digest for the entry date already exists")
	}
	// 孫を作る・親に親を付けるはどちらも同じ FK で落ちる。子のいる親の削除は先に避けるので、ここでは起きない
	if errors.As(err, &pg) && pg.Code == pgerrcode.ForeignKeyViolation && pg.ConstraintName == "articles_parent_id_parent_is_child_fkey" {
		return apperr.ValidationFailed(pg.ConstraintName + " violated")
	}
	if errors.As(err, &pg) && (pg.Code == pgerrcode.UniqueViolation || pg.Code == pgerrcode.CheckViolation) {
		return apperr.ValidationFailed(pg.ConstraintName + " violated")
	}
	return err
}

func urlsOf(entries []entry) []string {
	var urls []string
	for _, e := range entries {
		urls = append(urls, e.url)
		for _, c := range e.children {
			urls = append(urls, c.url)
		}
	}
	return urls
}

func originalURLs(entries []entry) []string {
	var urls []string
	for _, e := range entries {
		if !e.repost {
			urls = append(urls, e.url)
		}
		for _, c := range e.children {
			if !c.repost {
				urls = append(urls, c.url)
			}
		}
	}
	return urls
}

// 記事を表示するのは、隠しておらず、元の掲載の Digest が公開済みのときだけ
func visible(r db.ListArticlesByDigestRow) bool {
	return !r.Hidden && r.OriginalStatus != nil && *r.OriginalStatus == string(api.DigestStatusPublished)
}

func originalStatus(r db.ListArticlesByDigestRow) api.DigestStatus {
	if r.OriginalStatus == nil {
		return api.DigestStatusDraft
	}
	return api.DigestStatus(*r.OriginalStatus)
}

// public は公開ページ向けで、表示しない記事を外すか「非公開記事」に置き換える
func toDigest(d db.Digest, rows []db.ListArticlesByDigestRow, public bool) api.Digest {
	children := make(map[uuid.UUID][]api.ChildArticle)
	var parents []db.ListArticlesByDigestRow
	for _, r := range rows {
		if r.ParentID == nil {
			parents = append(parents, r)
			continue
		}
		if public && !visible(r) {
			continue
		}
		children[*r.ParentID] = append(children[*r.ParentID], api.ChildArticle{Id: r.ID, Category: api.Category(r.Category), Hot: r.IsHot, Repost: r.IsRepost, Hidden: r.Hidden,
			OriginalStatus: originalStatus(r), Title: r.Title, Url: r.Url, Description: r.Description})
	}
	articles := make([]api.Article, 0, len(parents))
	for _, p := range parents {
		cs := children[p.ID]
		if cs == nil {
			cs = []api.ChildArticle{}
		}
		// 呼び出した親は、この Digest では子のための再掲載
		repost := p.IsRepost || !p.Placed
		a := api.Article{Id: p.ID, Category: api.Category(p.Category), Repost: repost, Hidden: p.Hidden, Listed: p.Placed, OriginalStatus: originalStatus(p), Children: cs}
		if public && !visible(p) {
			// 子のない再掲載はそれ自体を読ませる掲載なので、中身を隠しても場所は残す
			if !(p.Placed && repost) && len(cs) == 0 {
				continue
			}
			concealed := true
			a.Concealed = &concealed
		} else {
			// 日付の変更で再掲載になった掲載は、元の掲載だったときの HOT を持ったまま (specs/018 Edge Cases)
			a.Hot = p.IsHot && !repost
			a.Title, a.Url, a.Description = &p.Title, &p.Url, p.Description
			if p.FirstPublishedOn != nil {
				a.FirstPublishedOn = &openapi_types.Date{Time: *p.FirstPublishedOn}
			}
		}
		// 記事のカテゴリは元の日のもので、再掲載の日は最初の子のカテゴリで出す (specs/018 FR-014)
		if repost {
			original := a.Category
			a.OriginalCategory = &original
			if len(cs) > 0 {
				a.Category = cs[0].Category
			}
		}
		articles = append(articles, a)
	}
	return api.Digest{Id: d.ID, EntryDate: openapi_types.Date{Time: d.EntryDate}, Status: api.DigestStatus(d.Status), Articles: articles}
}
