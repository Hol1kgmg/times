package auth

import (
	"context"
	"time"
)

// Principal は Bearer の照合に成功した管理者と session。newRouter の AuthenticationFunc が request context に載せる。
type Principal struct {
	UserID    int64
	Login     string
	ExpiresAt time.Time
	TokenHash []byte
}

type ctxKey struct{}

func WithPrincipal(ctx context.Context, p Principal) context.Context {
	return context.WithValue(ctx, ctxKey{}, p)
}

func PrincipalFrom(ctx context.Context) (Principal, bool) {
	p, ok := ctx.Value(ctxKey{}).(Principal)
	return p, ok
}
