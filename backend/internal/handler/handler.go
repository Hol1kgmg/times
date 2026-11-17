// Package handler は oapi-codegen の StrictServerInterface を実装する。
// ponytail: usecase / repository 層なし。handler が sqlc の Queries を直接呼ぶ。増えたら切る。
package handler

import (
	"context"
	"errors"
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
	out, err := s.withArticles(ctx, d)
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
		out, err := s.withArticles(ctx, d)
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
	out, err := s.withArticles(ctx, d)
	if err != nil {
		return nil, err
	}
	return api.GetDigestByDate200JSONResponse(out), nil
}

func (s *Server) withArticles(ctx context.Context, d db.Digest) (api.Digest, error) {
	rows, err := s.q.ListArticlesByDigest(ctx, d.ID)
	if err != nil {
		return api.Digest{}, err
	}
	return toDigest(d, rows), nil
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
	rows, reposted, err := saveArticles(ctx, q, d, p.UserID, req.Body.Articles)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return api.UpdateDigest200JSONResponse(toSavedDigest(d, rows, reposted)), nil
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
	rows, reposted, err := saveArticles(ctx, q, d, p.UserID, req.Body.Articles)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return api.CreateDigest201JSONResponse(toSavedDigest(d, rows, reposted)), nil
}

// Digest の掲載を入れ直す。記事の行は upsert で残し、どこにも載らなくなった記事だけ消す (adr/backend/0008)
// ponytail: 判定と書き込みの間に別の保存が同じ URL を新規に入れると、判定を通らずに掲載される。並行の保存が要るなら URL にも advisory lock をかける
// ponytail: 載っている記事は確かめ直さない (FR-009) ので、編集で再掲載を子へ動かしても断らない。表示は子として正しく出る
func saveArticles(ctx context.Context, q *db.Queries, d db.Digest, userID int64, articles []api.NewArticle) ([]db.ListArticlesByDigestRow, []string, error) {
	rows, err := q.ListRegisteredURLs(ctx, db.ListRegisteredURLsParams{CreatedBy: userID, DigestID: d.ID, Urls: urlsOf(articles)})
	if err != nil {
		return nil, nil, err
	}
	registered := make(map[string]bool, len(rows))
	for _, r := range rows {
		registered[r.Url] = r.PublishedElsewhere
	}
	reposted, rejected, needsChild := classifyReposts(articles, registered)
	if len(rejected) > 0 {
		return nil, nil, apperr.URLAlreadyRegistered(rejected)
	}
	if len(needsChild) > 0 {
		return nil, nil, apperr.RepostNeedsChild(needsChild)
	}
	if err := q.DeleteDigestArticles(ctx, d.ID); err != nil {
		return nil, nil, err
	}
	var pos int32
	// position は digest 内の通し番号で、子は親の hot を引き継ぐ
	place := func(category, title, url string, parent *uuid.UUID, hot bool) (uuid.UUID, error) {
		row, err := q.UpsertArticle(ctx, db.UpsertArticleParams{Category: category, Title: title, Url: url, CreatedBy: userID})
		if err != nil {
			return uuid.Nil, constraintViolation(err)
		}
		err = q.CreateDigestArticle(ctx, db.CreateDigestArticleParams{DigestID: d.ID, ArticleID: row.ID, ParentID: parent, Position: pos, IsHot: hot})
		if err != nil {
			return uuid.Nil, constraintViolation(err)
		}
		pos++
		return row.ID, nil
	}
	for _, a := range articles {
		hot := a.Hot != nil && *a.Hot
		parent, err := place(string(a.Category), a.Title, a.Url, nil, hot)
		if err != nil {
			return nil, nil, err
		}
		if a.Children == nil {
			continue
		}
		for _, c := range *a.Children {
			if _, err := place(string(a.Category), c.Title, c.Url, &parent, hot); err != nil {
				return nil, nil, err
			}
		}
	}
	if err := q.DeleteOrphanArticles(ctx, userID); err != nil {
		return nil, nil, err
	}
	saved, err := q.ListArticlesByDigest(ctx, d.ID)
	return saved, reposted, err
}

// 再掲載は、ほかの公開済み Digest に載っている記事を、新しい子を付けた親として入れたものだけ (specs/018 FR-005・FR-007)
func classifyReposts(articles []api.NewArticle, registered map[string]bool) (reposted, rejected, needsChild []string) {
	for _, a := range articles {
		fresh := 0
		if a.Children != nil {
			for _, c := range *a.Children {
				if _, ok := registered[c.Url]; ok {
					rejected = append(rejected, c.Url)
				} else {
					fresh++
				}
			}
		}
		published, ok := registered[a.Url]
		switch {
		case !ok:
		case !published:
			rejected = append(rejected, a.Url)
		case fresh == 0:
			needsChild = append(needsChild, a.Url)
		default:
			reposted = append(reposted, a.Url)
		}
	}
	return reposted, rejected, needsChild
}

var jst = time.FixedZone("JST", 9*60*60)

// 書き込み後の行で見るので、status の省略 (今のまま) や日付だけの変更でも同じく断れる。今日は JST で決める (specs/010 FR-006)
func publishable(d db.Digest, now time.Time) bool {
	today, _ := time.Parse(time.DateOnly, now.In(jst).Format(time.DateOnly))
	return d.Status != "published" || !d.EntryDate.After(today)
}

// 登録済みの日付・URL (unique) と空文字 (check) は入力の誤りなので 400 にする
func constraintViolation(err error) error {
	var pg *pgconn.PgError
	if errors.As(err, &pg) && pg.ConstraintName == "digests_created_by_entry_date_key" {
		return apperr.DigestAlreadyExists("digest for the entry date already exists")
	}
	if errors.As(err, &pg) && (pg.Code == pgerrcode.UniqueViolation || pg.Code == pgerrcode.CheckViolation) {
		return apperr.ValidationFailed(pg.ConstraintName + " violated")
	}
	return err
}

func urlsOf(articles []api.NewArticle) []string {
	var urls []string
	for _, a := range articles {
		urls = append(urls, a.Url)
		if a.Children != nil {
			for _, c := range *a.Children {
				urls = append(urls, c.Url)
			}
		}
	}
	return urls
}

func toSavedDigest(d db.Digest, rows []db.ListArticlesByDigestRow, reposted []string) api.SavedDigest {
	out := toDigest(d, rows)
	if reposted == nil {
		reposted = []string{}
	}
	return api.SavedDigest{Id: out.Id, EntryDate: out.EntryDate, Status: out.Status, Articles: out.Articles, RepostedUrls: reposted}
}

func toDigest(d db.Digest, rows []db.ListArticlesByDigestRow) api.Digest {
	children := make(map[uuid.UUID][]api.ChildArticle)
	articles := make([]api.Article, 0, len(rows))
	for _, r := range rows {
		if r.ParentID != nil {
			children[*r.ParentID] = append(children[*r.ParentID], api.ChildArticle{Id: r.ID, Title: r.Title, Url: r.Url, Description: r.Description})
			continue
		}
		var first *openapi_types.Date
		if r.FirstPublishedOn != nil {
			first = &openapi_types.Date{Time: *r.FirstPublishedOn}
		}
		articles = append(articles, api.Article{Id: r.ID, Category: api.Category(r.Category), Hot: r.IsHot, Title: r.Title, Url: r.Url, Description: r.Description, FirstPublishedOn: first})
	}
	for i := range articles {
		articles[i].Children = children[articles[i].Id]
		if articles[i].Children == nil {
			articles[i].Children = []api.ChildArticle{}
		}
	}
	return api.Digest{Id: d.ID, EntryDate: openapi_types.Date{Time: d.EntryDate}, Status: api.DigestStatus(d.Status), Articles: articles}
}
