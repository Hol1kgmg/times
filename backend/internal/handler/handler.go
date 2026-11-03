// Package handler は oapi-codegen の StrictServerInterface を実装する。
// ponytail: usecase / repository 層なし。handler が sqlc の Queries を直接呼ぶ。増えたら切る。
package handler

import (
	"context"
	"errors"

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
	links, err := s.q.ListArticleLinksByDigest(ctx, d.ID)
	if err != nil {
		return api.Digest{}, err
	}
	return toDigest(d, rows, links), nil
}

// 記事を消してから URL を判定するので、この Digest 自身の URL は登録済みに数えない
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
	d, err := q.UpdateDigest(ctx, db.UpdateDigestParams{NewDate: req.Body.EntryDate.Time, Status: (*string)(req.Body.Status), CreatedBy: p.UserID, OldDate: req.EntryDate.Time})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.NotFound("no digest for the entry date")
	}
	if err != nil {
		return nil, constraintViolation(err)
	}
	if err := q.DeleteArticlesByDigest(ctx, d.ID); err != nil {
		return nil, err
	}
	rows, links, err := insertArticles(ctx, q, d, p.UserID, req.Body.Articles)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return api.UpdateDigest200JSONResponse(toDigest(d, rows, links)), nil
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
	// 日付がぶつかるならリクエスト全体が成り立たないので、URL より先に確かめる
	status := api.NewDigestStatusDraft
	if req.Body.Status != nil {
		status = *req.Body.Status
	}
	d, err := q.CreateDigest(ctx, db.CreateDigestParams{EntryDate: req.Body.EntryDate.Time, CreatedBy: p.UserID, Status: string(status)})
	if err != nil {
		return nil, constraintViolation(err)
	}
	rows, links, err := insertArticles(ctx, q, d, p.UserID, req.Body.Articles)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return api.CreateDigest201JSONResponse(toDigest(d, rows, links)), nil
}

func insertArticles(ctx context.Context, q *db.Queries, d db.Digest, userID int64, articles []api.NewArticle) ([]db.Article, []db.ArticleLink, error) {
	registered, err := q.ListRegisteredURLs(ctx, db.ListRegisteredURLsParams{CreatedBy: userID, Urls: urlsOf(articles)})
	if err != nil {
		return nil, nil, err
	}
	if len(registered) > 0 {
		return nil, nil, apperr.URLAlreadyRegistered(registered)
	}
	var rows []db.Article
	var links []db.ArticleLink
	// 親子ともに articles の行。position は digest 内の通し番号で、子は親の category と hot を引き継ぐ
	insert := func(category, title, url string, hot bool) (db.Article, error) {
		row, err := q.CreateArticle(ctx, db.CreateArticleParams{
			DigestID: d.ID, Position: int32(len(rows)), Category: category, Title: title, Url: url, IsHot: hot, CreatedBy: userID,
		})
		if err != nil {
			return row, constraintViolation(err)
		}
		rows = append(rows, row)
		return row, nil
	}
	for _, a := range articles {
		hot := a.Hot != nil && *a.Hot
		parent, err := insert(string(a.Category), a.Title, a.Url, hot)
		if err != nil {
			return nil, nil, err
		}
		if a.Children == nil {
			continue
		}
		for j, c := range *a.Children {
			child, err := insert(string(a.Category), c.Title, c.Url, hot)
			if err != nil {
				return nil, nil, err
			}
			link := db.ArticleLink{ParentID: parent.ID, ChildID: child.ID, Position: int32(j)}
			if err := q.CreateArticleLink(ctx, db.CreateArticleLinkParams(link)); err != nil {
				return nil, nil, err
			}
			links = append(links, link)
		}
	}
	return rows, links, nil
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

func toDigest(d db.Digest, rows []db.Article, links []db.ArticleLink) api.Digest {
	parentOf := make(map[uuid.UUID]uuid.UUID, len(links))
	for _, l := range links {
		parentOf[l.ChildID] = l.ParentID
	}
	children := make(map[uuid.UUID][]api.ChildArticle)
	articles := make([]api.Article, 0, len(rows)-len(links))
	for _, r := range rows {
		if p, ok := parentOf[r.ID]; ok {
			children[p] = append(children[p], api.ChildArticle{Id: r.ID, Title: r.Title, Url: r.Url, Description: r.Description})
			continue
		}
		articles = append(articles, api.Article{Id: r.ID, Category: api.Category(r.Category), Hot: r.IsHot, Title: r.Title, Url: r.Url, Description: r.Description})
	}
	for i := range articles {
		articles[i].Children = children[articles[i].Id]
		if articles[i].Children == nil {
			articles[i].Children = []api.ChildArticle{}
		}
	}
	return api.Digest{Id: d.ID, EntryDate: openapi_types.Date{Time: d.EntryDate}, Status: api.DigestStatus(d.Status), Articles: articles}
}
