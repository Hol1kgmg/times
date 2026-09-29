package handler

import (
	"context"
	"strings"
	"time"

	"github.com/Hol1kgmg/times/backend/internal/api"
	"github.com/Hol1kgmg/times/backend/internal/apperr"
	"github.com/Hol1kgmg/times/backend/internal/auth"
	"github.com/Hol1kgmg/times/backend/internal/db"
)

const sessionTTL = 30 * 24 * time.Hour // 延長しない (specs/003 FR-007)

// ponytail: interface は handler テスト用。増えたら sqlc の Querier を使う
type authQueries interface {
	UpsertUser(ctx context.Context, arg db.UpsertUserParams) (db.User, error)
	CreateSession(ctx context.Context, arg db.CreateSessionParams) (db.Session, error)
	DeleteExpiredSessions(ctx context.Context) error
	DeleteSessionByTokenHash(ctx context.Context, tokenHash []byte) error
}

// CreateSession は GitHub の code を検証し、許可ユーザーなら session を発行する。
// 順序: 未設定 → 403、GitHub 失敗 → 502、login 不一致 → 403 (何も保存しない)、一致 → upsert + 発行。
func (s *Server) CreateSession(ctx context.Context, req api.CreateSessionRequestObject) (api.CreateSessionResponseObject, error) {
	if !s.authConfigured {
		return nil, apperr.Forbidden("github login is not configured")
	}
	u, err := s.gh.Exchange(ctx, req.Body.Code, req.Body.RedirectUri)
	if err != nil {
		return nil, err
	}
	if !strings.EqualFold(u.Login, s.adminLogin) {
		return nil, apperr.Forbidden("account is not allowed")
	}
	user, err := s.authq.UpsertUser(ctx, db.UpsertUserParams{ID: u.ID, Login: u.Login})
	if err != nil {
		return nil, err
	}
	if err := s.authq.DeleteExpiredSessions(ctx); err != nil {
		return nil, err
	}
	token, err := auth.NewToken()
	if err != nil {
		return nil, err
	}
	sess, err := s.authq.CreateSession(ctx, db.CreateSessionParams{
		TokenHash: auth.Hash(token), UserID: user.ID, ExpiresAt: time.Now().Add(sessionTTL),
	})
	if err != nil {
		return nil, err
	}
	return api.CreateSession201JSONResponse{
		Token: token, User: api.AdminUser{Id: user.ID, Login: user.Login}, ExpiresAt: sess.ExpiresAt,
	}, nil
}

func (s *Server) GetCurrentSession(ctx context.Context, _ api.GetCurrentSessionRequestObject) (api.GetCurrentSessionResponseObject, error) {
	p, ok := auth.PrincipalFrom(ctx)
	if !ok {
		// security: [bearerAuth] の配線漏れの検出用
		return nil, apperr.Unauthorized("no session in context")
	}
	return api.GetCurrentSession200JSONResponse{User: api.AdminUser{Id: p.UserID, Login: p.Login}, ExpiresAt: p.ExpiresAt}, nil
}

// DeleteCurrentSession はログアウト。行が無くても 204 (冪等)。
func (s *Server) DeleteCurrentSession(ctx context.Context, _ api.DeleteCurrentSessionRequestObject) (api.DeleteCurrentSessionResponseObject, error) {
	p, ok := auth.PrincipalFrom(ctx)
	if !ok {
		return nil, apperr.Unauthorized("no session in context")
	}
	if err := s.authq.DeleteSessionByTokenHash(ctx, p.TokenHash); err != nil {
		return nil, err
	}
	return api.DeleteCurrentSession204Response{}, nil
}
