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

func (s *Server) Health(context.Context, api.HealthRequestObject) (api.HealthResponseObject, error) {
	return api.Health200JSONResponse{Status: "ok"}, nil
}

func (s *Server) ListItems(ctx context.Context, _ api.ListItemsRequestObject) (api.ListItemsResponseObject, error) {
	rows, err := s.q.ListItems(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]api.Item, len(rows))
	for i, r := range rows {
		out[i] = toItem(r)
	}
	return api.ListItems200JSONResponse{Items: out}, nil
}

func (s *Server) GetItem(ctx context.Context, req api.GetItemRequestObject) (api.GetItemResponseObject, error) {
	row, err := s.q.GetItem(ctx, req.Id)
	if errors.Is(err, pgx.ErrNoRows) {
		// DB の意味を知っているのは handler。配線層で pgx を見ない (adr/backend/0002)
		return nil, apperr.NotFound("item " + req.Id.String() + " does not exist")
	}
	if err != nil {
		return nil, err
	}
	return api.GetItem200JSONResponse(toItem(row)), nil
}

func (s *Server) CreateItem(ctx context.Context, req api.CreateItemRequestObject) (api.CreateItemResponseObject, error) {
	row, err := s.q.CreateItem(ctx, req.Body.Title)
	if err != nil {
		return nil, err
	}
	return api.CreateItem201JSONResponse(toItem(row)), nil
}

func (s *Server) GetLatestDigest(ctx context.Context, _ api.GetLatestDigestRequestObject) (api.GetLatestDigestResponseObject, error) {
	d, err := s.q.GetLatestDigest(ctx)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.NotFound("no digest registered")
	}
	if err != nil {
		return nil, err
	}
	rows, err := s.q.ListArticlesByDigest(ctx, d.ID)
	if err != nil {
		return nil, err
	}
	links, err := s.q.ListArticleLinksByDigest(ctx, d.ID)
	if err != nil {
		return nil, err
	}
	return api.GetLatestDigest200JSONResponse(toDigest(d, rows, links)), nil
}

// digest と articles を 1 トランザクションで入れる。途中で失敗したら digest も残さない
func (s *Server) CreateDigest(ctx context.Context, req api.CreateDigestRequestObject) (api.CreateDigestResponseObject, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	q := s.q.WithTx(tx)
	d, err := q.CreateDigest(ctx, req.Body.EntryDate.Time)
	if err != nil {
		return nil, err
	}
	var rows []db.Article
	var links []db.ArticleLink
	// 親子ともに articles の行。position は digest 内の通し番号で、子は親の category と hot を引き継ぐ
	insert := func(category, title, url string, hot bool) (db.Article, error) {
		row, err := q.CreateArticle(ctx, db.CreateArticleParams{
			DigestID: d.ID, Position: int32(len(rows)), Category: category, Title: title, Url: url, IsHot: hot,
		})
		if err != nil {
			return row, constraintViolation(err)
		}
		rows = append(rows, row)
		return row, nil
	}
	for _, a := range req.Body.Items {
		hot := a.Hot != nil && *a.Hot
		parent, err := insert(string(a.Category), a.Title, a.Url, hot)
		if err != nil {
			return nil, err
		}
		if a.Children == nil {
			continue
		}
		for j, c := range *a.Children {
			child, err := insert(string(a.Category), c.Title, c.Url, hot)
			if err != nil {
				return nil, err
			}
			link := db.ArticleLink{ParentID: parent.ID, ChildID: child.ID, Position: int32(j)}
			if err := q.CreateArticleLink(ctx, db.CreateArticleLinkParams(link)); err != nil {
				return nil, err
			}
			links = append(links, link)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return api.CreateDigest201JSONResponse(toDigest(d, rows, links)), nil
}

// 同じ digest 内の URL 重複 (unique) と空文字 (check) は入力の誤りなので 400 にする
func constraintViolation(err error) error {
	var pg *pgconn.PgError
	if errors.As(err, &pg) && (pg.Code == pgerrcode.UniqueViolation || pg.Code == pgerrcode.CheckViolation) {
		return apperr.ValidationFailed(pg.ConstraintName + " violated")
	}
	return err
}

func toDigest(d db.Digest, rows []db.Article, links []db.ArticleLink) api.Digest {
	parentOf := make(map[uuid.UUID]uuid.UUID, len(links))
	for _, l := range links {
		parentOf[l.ChildID] = l.ParentID
	}
	children := make(map[uuid.UUID][]api.ChildArticle)
	items := make([]api.Article, 0, len(rows)-len(links))
	for _, r := range rows {
		if p, ok := parentOf[r.ID]; ok {
			children[p] = append(children[p], api.ChildArticle{Id: r.ID, Title: r.Title, Url: r.Url, Description: r.Description})
			continue
		}
		items = append(items, api.Article{Id: r.ID, Category: api.Category(r.Category), Hot: r.IsHot, Title: r.Title, Url: r.Url, Description: r.Description})
	}
	for i := range items {
		items[i].Children = children[items[i].Id]
		if items[i].Children == nil {
			items[i].Children = []api.ChildArticle{}
		}
	}
	return api.Digest{Id: d.ID, EntryDate: openapi_types.Date{Time: d.EntryDate}, Items: items}
}

func toItem(r db.Item) api.Item {
	return api.Item{Id: r.ID, Title: r.Title, CreatedAt: r.CreatedAt}
}
