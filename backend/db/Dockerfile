# Cloud Run Job 用。compose.yaml の migrate サービスと同じイメージにマイグレーションを焼く。
# 接続先は DATABASE_URL (Secret Manager から注入) で受ける。引数は migrate のサブコマンド (up / down 1 など)
FROM migrate/migrate:v4.18.3
COPY migrations /migrations
ENTRYPOINT ["sh", "-c", "exec migrate -path /migrations -database \"$DATABASE_URL\" \"$@\"", "--"]
CMD ["up"]
