// Package handler は oapi-codegen の StrictServerInterface を実装する。
// ponytail: usecase / repository 層なし。handler が sqlc の Queries を直接呼ぶ。増えたら切る。
package handler

import (
	"context"
	"errors"

	"github.com/Hol1kgmg/times/backend/internal/api"
	"github.com/Hol1kgmg/times/backend/internal/apperr"
	"github.com/Hol1kgmg/times/backend/internal/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Server struct {
	q *db.Queries
}

var _ api.StrictServerInterface = (*Server)(nil)

func New(pool *pgxpool.Pool) *Server {
	return &Server{q: db.New(pool)}
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

func toItem(r db.Item) api.Item {
	return api.Item{Id: r.ID, Title: r.Title, CreatedAt: r.CreatedAt}
}
