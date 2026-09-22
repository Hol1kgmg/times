package main

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"log"
	"log/slog"
	"net/http"
	"os"

	"github.com/Hol1kgmg/times/backend/internal/api"
	"github.com/Hol1kgmg/times/backend/internal/apperr"
	"github.com/Hol1kgmg/times/backend/internal/handler"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	ginmiddleware "github.com/oapi-codegen/gin-middleware"
)

func main() {
	ctx := context.Background()

	// compose.yaml の db サービスに合わせた開発用デフォルト
	dsn := cmp.Or(os.Getenv("DATABASE_URL"), "postgres://times:times@localhost:5432/times?sslmode=disable")
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()

	r, err := newRouter(handler.New(pool))
	if err != nil {
		log.Fatal(err)
	}
	log.Fatal(r.Run(":" + cmp.Or(os.Getenv("PORT"), "8080")))
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

	r := gin.Default()
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
