package main

import (
	"cmp"
	"context"
	"log"
	"net/http"
	"os"

	"github.com/Hol1kgmg/times/backend/internal/api"
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

func newRouter(s api.StrictServerInterface) (*gin.Engine, error) {
	spec, err := api.GetSwagger()
	if err != nil {
		return nil, err
	}
	// servers が空でないとホスト名まで検証されるので外す
	spec.Servers = nil

	r := gin.Default()
	r.Use(ginmiddleware.OapiRequestValidatorWithOptions(spec, &ginmiddleware.Options{
		ErrorHandler: func(c *gin.Context, message string, statusCode int) {
			c.AbortWithStatusJSON(statusCode, api.Error{Message: message})
		},
	}))
	api.RegisterHandlers(r, api.NewStrictHandlerWithOptions(s, nil, api.StrictGinServerOptions{
		RequestErrorHandlerFunc: func(c *gin.Context, err error) {
			c.AbortWithStatusJSON(http.StatusBadRequest, api.Error{Message: err.Error()})
		},
		ResponseErrorHandlerFunc: func(c *gin.Context, err error) {
			// 内部エラーの文言はクライアントに返さない
			log.Printf("handler error: %v", err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, api.Error{Message: "internal server error"})
		},
	}))
	return r, nil
}
