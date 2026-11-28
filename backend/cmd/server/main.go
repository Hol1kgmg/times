package main

import (
	"cmp"
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"runtime/debug"
	"strings"
	"syscall"
	"time"

	"github.com/Hol1kgmg/times/backend/internal/api"
	"github.com/Hol1kgmg/times/backend/internal/apperr"
	"github.com/Hol1kgmg/times/backend/internal/auth"
	"github.com/Hol1kgmg/times/backend/internal/db"
	"github.com/Hol1kgmg/times/backend/internal/handler"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	ginmiddleware "github.com/oapi-codegen/gin-middleware"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

const maxBodyBytes = 1 << 20 // 1 MiB。spec の maxLength は本文を全部読んでからしか効かない

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{ReplaceAttr: cloudLoggingAttr})))
	if err := run(); err != nil {
		slog.Error("exit", "err", err)
		os.Exit(1)
	}
}

func run() error {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// Secret Manager 経由だと末尾に改行が付くことがある。ヘッダー側は trim 済みで届くので揃える
	token := strings.TrimSpace(os.Getenv("BACKEND_TOKEN"))
	if err := requireBackendToken(token, os.Getenv("K_SERVICE")); err != nil {
		return err
	}

	// compose.yaml の db サービスに合わせた開発用デフォルト
	cfg, err := pgxpool.ParseConfig(cmp.Or(os.Getenv("DATABASE_URL"), "postgres://times:times@localhost:5432/times?sslmode=disable"))
	if err != nil {
		return err
	}
	cfg.ConnConfig.RuntimeParams["statement_timeout"] = "5s" // 遅いクエリを DB 側で打ち切る
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return err
	}
	defer pool.Close()

	// 管理者ログイン (adr/backend/0007)。いずれか空なら POST /auth/sessions は常に 403 で、他の操作は影響を受けない
	gh := auth.Client{
		HTTP:         &http.Client{Timeout: 10 * time.Second},
		BaseURL:      cmp.Or(os.Getenv("GITHUB_BASE_URL"), "https://github.com"),
		APIURL:       cmp.Or(os.Getenv("GITHUB_API_URL"), "https://api.github.com"),
		ClientID:     strings.TrimSpace(os.Getenv("GITHUB_CLIENT_ID")),
		ClientSecret: strings.TrimSpace(os.Getenv("GITHUB_CLIENT_SECRET")),
	}
	adminLogin := strings.TrimSpace(os.Getenv("ADMIN_GITHUB_LOGIN"))
	if gh.ClientID == "" || gh.ClientSecret == "" || adminLogin == "" {
		slog.Warn("github login is not configured; POST /auth/sessions always 403")
	}

	r, err := newRouter(handler.New(pool, gh, adminLogin), token, db.New(pool).GetSessionByTokenHash)
	if err != nil {
		return err
	}
	srv := &http.Server{
		Addr:              ":" + cmp.Or(os.Getenv("PORT"), "8080"),
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
	}
	errc := make(chan error, 1)
	go func() { errc <- srv.ListenAndServe() }()
	slog.Info("listening", "addr", srv.Addr)

	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
	}
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}

// requireBackendToken は Cloud Run (K_SERVICE がある) で BACKEND_TOKEN が空のまま、到達制限なしで起動するのを止める。
func requireBackendToken(token, service string) error {
	if service != "" && token == "" {
		return errors.New("BACKEND_TOKEN is required on Cloud Run")
	}
	return nil
}

// cloudLoggingAttr は slog の JSON を Cloud Logging が重大度と本文として読むキーにする。
func cloudLoggingAttr(groups []string, a slog.Attr) slog.Attr {
	if len(groups) > 0 {
		return a
	}
	switch lv, ok := a.Value.Any().(slog.Level); {
	case a.Key == slog.LevelKey && ok:
		return slog.String("severity", severity(lv))
	case a.Key == slog.MessageKey:
		a.Key = "message"
	}
	return a
}

// severity は Cloud Logging の LogSeverity の名前にする。slog の WARN や ERROR+4 のままでは DEFAULT 扱いになる
func severity(lv slog.Level) string {
	switch {
	case lv >= slog.LevelError:
		return "ERROR"
	case lv >= slog.LevelWarn:
		return "WARNING"
	case lv >= slog.LevelInfo:
		return "INFO"
	}
	return "DEBUG"
}

// errPanic は Recovery がログを書き終えた 500。writeProblem で二重に出さない
var errPanic = errors.New("panic")

// sessionLookup は Bearer トークンの sha256 から有効な session を引く。見つからなければ pgx.ErrNoRows。
type sessionLookup func(ctx context.Context, tokenHash []byte) (db.GetSessionByTokenHashRow, error)

// newRouter は framework に触る唯一の場所。handler は gin を知らない。
// token が空なら到達制限なし (compose での開発用)。本番は Secret Manager から必ず注入する (docs/deploy.md)。
// lookup は openapi.yaml で security: [bearerAuth] を宣言した操作だけに使われる (adr/backend/0007)。
// ADR: adr/backend/0001-adopt-gin-behind-oapi-codegen-strict-server.md
func newRouter(s api.StrictServerInterface, token string, lookup sessionLookup) (*gin.Engine, error) {
	spec, err := api.GetSwagger()
	if err != nil {
		return nil, err
	}
	// servers が空でないとホスト名まで検証されるので外す
	spec.Servers = nil

	r := gin.New()
	// handler は *gin.Context を context.Context として受け取る。request context の値 (auth.Principal) を引けるようにする
	r.ContextWithFallback = true
	r.Use(
		accessLog,
		// panic も Problem Details にする (adr/backend/0002)。gin の stderr の複数行ではなく、スタックごと slog の 1 エントリに出す
		gin.CustomRecoveryWithWriter(nil, func(c *gin.Context, v any) {
			// Error Reporting は stack_trace の "panic: ..." に続く goroutine のスタックを読んでまとめる
			slog.Error("panic", "stack_trace", fmt.Sprintf("panic: %v\n\n%s", v, debug.Stack()), "method", c.Request.Method, "path", c.Request.URL.Path)
			writeProblem(c, errPanic)
		}),
		func(c *gin.Context) { c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBodyBytes) },
	)
	if token == "" {
		slog.Warn("BACKEND_TOKEN is empty; auth disabled")
	} else {
		// 呼び元は Workers のサーバー関数だけ (adr/backend/0003)。共有シークレットで他からの到達を断つ
		r.Use(func(c *gin.Context) {
			if subtle.ConstantTimeCompare([]byte(c.GetHeader("X-Backend-Token")), []byte(token)) != 1 {
				writeProblem(c, apperr.InvalidBackendToken("missing or invalid X-Backend-Token"))
			}
		})
	}
	r.Use(ginmiddleware.OapiRequestValidatorWithOptions(spec, &ginmiddleware.Options{
		ErrorHandler: func(c *gin.Context, message string, status int) {
			// gin-middleware は error を文字列に潰して渡すので、認証失敗は AuthenticationFunc の中で書き終えている
			if c.Writer.Written() {
				return
			}
			if status == http.StatusNotFound {
				writeProblem(c, apperr.NotFound(message))
				return
			}
			writeProblem(c, apperr.ValidationFailed(message))
		},
		Options: openapi3filter.Options{AuthenticationFunc: func(ctx context.Context, in *openapi3filter.AuthenticationInput) error {
			if in.SecuritySchemeName != "bearerAuth" {
				return fmt.Errorf("unknown security scheme %q", in.SecuritySchemeName)
			}
			c := ginmiddleware.GetGinContext(ctx)
			err := authenticateBearer(c, lookup)
			if err != nil {
				writeProblem(c, err)
			}
			return err
		}},
	}))
	badRequest := func(c *gin.Context, err error) { writeProblem(c, apperr.ValidationFailed(err.Error())) }
	strict := api.NewStrictHandlerWithOptions(s, nil, api.StrictGinServerOptions{
		RequestErrorHandlerFunc:  badRequest,   // JSON デコード失敗
		HandlerErrorFunc:         writeProblem, // handler が返した error (apperr か想定外)
		ResponseErrorHandlerFunc: writeProblem, // レスポンス書き出し失敗
	})
	api.RegisterHandlersWithOptions(r, strict, api.GinServerOptions{
		ErrorHandler: func(c *gin.Context, err error, _ int) { badRequest(c, err) }, // パスパラメータの形式違反
	})
	return r, nil
}

// authenticateBearer は Authorization: Bearer <token> を照合し、成功したら auth.Principal を request context に載せる。
// 失敗はすべて 401 /problems/unauthorized。トークンの平文はログに出さない
func authenticateBearer(c *gin.Context, lookup sessionLookup) error {
	token, ok := strings.CutPrefix(c.GetHeader("Authorization"), "Bearer ")
	if !ok || token == "" {
		return apperr.Unauthorized("missing or invalid bearer token")
	}
	hash := auth.Hash(token)
	row, err := lookup(c.Request.Context(), hash)
	if errors.Is(err, pgx.ErrNoRows) {
		return apperr.Unauthorized("missing or invalid bearer token")
	}
	if err != nil {
		return err
	}
	c.Request = c.Request.WithContext(auth.WithPrincipal(c.Request.Context(), auth.Principal{
		UserID: row.UserID, Login: row.Login, ExpiresAt: row.ExpiresAt, TokenHash: hash,
	}))
	return nil
}

// accessLog は gin.Logger の代わり。500 のログと同じ slog (JSON) に出す。
func accessLog(c *gin.Context) {
	start := time.Now()
	c.Next()
	slog.Info("request",
		"method", c.Request.Method, "path", c.Request.URL.Path,
		"status", c.Writer.Status(), "duration_ms", time.Since(start).Milliseconds())
}

// writeProblem は error を RFC 9457 Problem Details に変換する唯一の場所。
// *apperr.Error 以外は想定外として 500 にし、内部エラーの文言はクライアントに返さない。5xx はどちらも slog に出す。
// ADR: adr/backend/0002-return-errors-as-rfc9457-problem-details.md
func writeProblem(c *gin.Context, err error) {
	p := api.Problem{Type: api.AboutBlank, Status: http.StatusInternalServerError}
	var e *apperr.Error
	if errors.As(err, &e) {
		p = api.Problem{Type: api.ProblemType(e.Type), Status: e.Status, Detail: &e.Detail}
		if e.DuplicateURLs != nil {
			p.DuplicateUrls = &e.DuplicateURLs
		}
		if e.Repostable != nil {
			r := make([]api.Repostable, len(e.Repostable))
			for i, x := range e.Repostable {
				r[i] = api.Repostable{Url: x.URL, Title: x.Title, Category: api.Category(x.Category), FirstPublishedOn: openapi_types.Date{Time: x.FirstPublishedOn}}
			}
			p.Repostable = &r
		}
		if e.Hideable != nil {
			h := make([]api.Hideable, len(e.Hideable))
			for i, x := range e.Hideable {
				h[i] = api.Hideable{Url: x.URL, Title: x.Title, Category: api.Category(x.Category)}
			}
			p.Hideable = &h
		}
	}
	if p.Status >= http.StatusInternalServerError && !errors.Is(err, errPanic) {
		slog.Error("handler error", "err", err, "method", c.Request.Method, "path", c.Request.URL.Path)
	}
	p.Title = http.StatusText(p.Status)
	body, _ := json.Marshal(p)
	// c.JSON は Content-Type を application/json に固定するので c.Data で書く
	c.Data(p.Status, "application/problem+json", body)
	c.Abort()
}
