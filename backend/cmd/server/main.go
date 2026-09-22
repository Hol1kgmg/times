package main

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Hol1kgmg/times/backend/internal/api"
	"github.com/Hol1kgmg/times/backend/internal/apperr"
	"github.com/Hol1kgmg/times/backend/internal/handler"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	ginmiddleware "github.com/oapi-codegen/gin-middleware"
)

const maxBodyBytes = 1 << 20 // 1 MiB。spec の maxLength は本文を全部読んでからしか効かない

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	if err := run(); err != nil {
		slog.Error("exit", "err", err)
		os.Exit(1)
	}
}

func run() error {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

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

	r, err := newRouter(handler.New(pool))
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

// newRouter は framework に触る唯一の場所。handler は gin を知らない。
// ADR: adr/backend/0001-adopt-gin-behind-oapi-codegen-strict-server.md
func newRouter(s api.StrictServerInterface) (*gin.Engine, error) {
	spec, err := api.GetSwagger()
	if err != nil {
		return nil, err
	}
	// servers が空でないとホスト名まで検証されるので外す
	spec.Servers = nil

	r := gin.New()
	r.Use(
		accessLog,
		// panic も Problem Details にする (adr/backend/0002)。writeProblem が 500 として slog に出す
		gin.CustomRecovery(func(c *gin.Context, v any) { writeProblem(c, fmt.Errorf("panic: %v", v)) }),
		func(c *gin.Context) { c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBodyBytes) },
	)
	r.Use(ginmiddleware.OapiRequestValidatorWithOptions(spec, &ginmiddleware.Options{
		ErrorHandler: func(c *gin.Context, message string, _ int) {
			writeProblem(c, apperr.ValidationFailed(message))
		},
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

// accessLog は gin.Logger の代わり。500 のログと同じ slog (JSON) に出す。
func accessLog(c *gin.Context) {
	start := time.Now()
	c.Next()
	slog.Info("request",
		"method", c.Request.Method, "path", c.Request.URL.Path,
		"status", c.Writer.Status(), "duration_ms", time.Since(start).Milliseconds())
}

// writeProblem は error を RFC 9457 Problem Details に変換する唯一の場所。
// *apperr.Error 以外は想定外として 500 にし、内部エラーの文言はクライアントに返さない。
// ADR: adr/backend/0002-return-errors-as-rfc9457-problem-details.md
func writeProblem(c *gin.Context, err error) {
	p := api.Problem{Type: api.AboutBlank, Status: http.StatusInternalServerError}
	var e *apperr.Error
	if errors.As(err, &e) {
		p = api.Problem{Type: api.ProblemType(e.Type), Status: e.Status, Detail: &e.Detail}
	} else {
		slog.Error("handler error", "err", err, "method", c.Request.Method, "path", c.Request.URL.Path)
	}
	p.Title = http.StatusText(p.Status)
	body, _ := json.Marshal(p)
	// c.JSON は Content-Type を application/json に固定するので c.Data で書く
	c.Data(p.Status, "application/problem+json", body)
	c.Abort()
}
