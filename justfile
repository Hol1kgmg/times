# 命名規則: frontend のみ → fe-*、backend のみ → be-*、DB / マイグレーション → db-*、両方 / リポジトリ全体 → prefix なし

# List recipes
list:
    @just --list

# Install skills into .claude/skills
skills:
    nix run .#skills-install-local

# List installed skills
skills-list:
    nix run .#skills-list

# Re-pin skill sources
skills-update:
    nix run .#skills-sources-lock

# Update all locks, then check
update:
    nix flake update
    nix run .#skills-sources-lock
    nix flake check

# Merge template updates from upstream
sync:
    #!/usr/bin/env bash
    set -euo pipefail
    git remote get-url upstream >/dev/null 2>&1 \
        || git remote add upstream https://github.com/Hol1kgmg/claude-temp.git
    git fetch --no-tags upstream main
    # 初回（共通祖先なし）はテンプレート生成由来の同一ファイルが全部 both added で衝突するため、
    # upstream 側を採用する。2 回目以降は独自変更を守るため通常マージ。
    # マージコミットであることが必須。squash / rebase すると共通祖先が失われ、
    # 次回以降ツリー全体が衝突する（adr/from-template/0001）
    if git merge-base HEAD upstream/main >/dev/null 2>&1; then
        git merge upstream/main --no-edit
    else
        git merge upstream/main --allow-unrelated-histories --no-edit -X theirs
    fi

# Scan working tree for secrets
scan:
    gitleaks dir --verbose

# Scan staged changes for secrets
scan-staged:
    gitleaks protect --staged --verbose

# Run all tests
test: fe-test be-test

# Run all linters
lint: fe-lint be-lint

# Format all code
format: fe-format be-format

# Serve markdown at http://localhost:8080
docs *ARGS:
    markserv . -p 8080 -a 0.0.0.0 --browser=false {{ARGS}}

# --- frontend ---

# Install frontend dependencies
fe-install:
    pnpm -C frontend install

# Uninstall frontend dependencies
fe-uninstall *args:
    pnpm -C frontend uninstall {{args}}

# Add frontend dependencies
fe-add *args:
    pnpm -C frontend add {{args}}

# Remove frontend dependencies
fe-remove *args:
    pnpm -C frontend remove {{args}}

# Update frontend dependencies
fe-upgrade *args:
    pnpm -C frontend update {{args}}

# Start the development server
fe-dev *args:
    pnpm -C frontend dev {{args}}

# Start the development server bound to 0.0.0.0
fe-dev-host *args:
    pnpm -C frontend dev:host {{args}}

# Build for production
fe-build:
    pnpm -C frontend build

# Preview the production build
fe-preview:
    pnpm -C frontend preview

# Generate TanStack Router route tree
fe-generate-routes:
    pnpm -C frontend generate-routes

# Run unit tests
fe-test *args:
    pnpm -C frontend test {{args}}

# Run E2E tests
fe-test-e2e *args:
    pnpm -C frontend test:e2e {{args}}

# Run E2E tests with UI
fe-test-e2e-ui *args:
    pnpm -C frontend test:e2e:ui {{args}}

# Run linter
fe-lint:
    pnpm -C frontend lint

# Run markup linter
fe-lint-markup:
    pnpm -C frontend lint:markup

# Format code
fe-format:
    pnpm -C frontend format

# Run TypeScript type check
fe-typecheck:
    pnpm -C frontend typecheck

# Deploy to Cloudflare Workers
fe-deploy:
    pnpm -C frontend deploy

# --- backend ---

# Start the API server (needs `just db-up`)
be-dev *args:
    cd backend && go run ./cmd/server {{args}}

# Regenerate oapi-codegen and sqlc output
be-gen:
    cd backend && oapi-codegen -config api/oapi-codegen.yaml api/openapi.yaml && sqlc generate

# Run backend tests
be-test *args:
    cd backend && go test ./... {{args}}

# Run gofmt check and go vet
be-lint:
    cd backend && test -z "$(gofmt -l .)" && go vet ./...

# Format backend code
be-format:
    cd backend && gofmt -w .

# Tidy go.mod
be-tidy:
    cd backend && go mod tidy

# Build and start db + migrate + api
be-up:
    docker compose up --build

# --- db ---

# Start Postgres and apply migrations
db-up:
    # --wait は one-shot の migrate が正常終了しても失敗扱いにするため、migrate は run で待つ
    docker compose up -d --wait db
    docker compose run --rm migrate

# Stop containers (keeps data)
db-down:
    docker compose down

# Stop containers and delete data
db-reset:
    docker compose down -v

# Load dev dummy data (backend/db/seed.sql, idempotent)
db-seed:
    docker compose exec -T db psql -U times -d times -v ON_ERROR_STOP=1 < backend/db/seed.sql

# Run golang-migrate (e.g. `just db-migrate down 1`, `just db-migrate version`)
db-migrate *args:
    docker compose run --rm migrate -path /migrations -database "postgres://times:times@db:5432/times?sslmode=disable" {{args}}

# Create a migration pair: db/migrations/NNNNNN_<name>.{up,down}.sql
db-migrate-new name:
    docker compose run --rm migrate create -ext sql -dir /migrations -seq {{name}}
