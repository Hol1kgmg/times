// Package handler は oapi-codegen の StrictServerInterface を実装する。
// ponytail: usecase / repository 層なし。handler が sqlc の Queries を直接呼ぶ。増えたら切る。
package handler

import (
	"context"

	"github.com/Hol1kgmg/times/backend/internal/api"
	"github.com/Hol1kgmg/times/backend/internal/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Server struct {
	q *db.Queries
}

var _ api.StrictServerInterface = (*Server)(nil)

func New(pool *pgxpool.Pool) *Server {
	return &Server{q: db.New(pool)}
}

func (s *Server) Healthz(context.Context, api.HealthzRequestObject) (api.HealthzResponseObject, error) {
	return api.Healthz200JSONResponse{Status: "ok"}, nil
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
	return api.ListItems200JSONResponse(out), nil
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
