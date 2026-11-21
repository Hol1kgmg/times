# 命名規則: frontend のみ → fe-*、backend のみ → be-*、DB / マイグレーション → db-*、両方 / リポジトリ全体 → prefix なし
# gcloud (本番の backend / DB 操作) はここに載せない。手順は docs/deploy.md

# List recipes
list:
    @just --list

# Install skills and rules into .agents/skills and .claude/rules
apm:
    apm install

# List installed skills and rules
apm-list:
    apm deps list

# Dependabot の apm 0.34.0 が書いた lock は content_hash が欠けて --frozen が通らない。dependabot-core#16792 のマージ後に消す
# Regenerate apm.lock.yaml on a Dependabot PR and push it
apm-fix-lock PR:
    #!/usr/bin/env bash
    set -euo pipefail
    [ -z "$(git status --porcelain)" ] || { echo "作業ツリーを clean にしてから実行する" >&2; exit 1; }
    orig=$(git branch --show-current)
    [ -n "$orig" ] || { echo "detached HEAD では実行しない。ブランチに切り替えてから実行する" >&2; exit 1; }
    # upstream remote があると gh は origin より upstream を既定の repo に選ぶ
    export GH_REPO=$(git remote get-url origin | sed -E 's#(\.git)?$##; s#.*github\.com[:/]##')
    trap 'git switch "$orig"' EXIT
    # Dependabot が force-push した後は、手元に残った同名ブランチと食い違って checkout できない
    gh pr checkout --force {{PR}}
    apm install
    if git diff --quiet apm.lock.yaml; then
        echo "lock は直す必要がない"
    else
        git commit -m "fix: apm.lock.yaml を手元の apm で作り直す" apm.lock.yaml
        git push
    fi

# Update flake.lock, then check
update:
    nix flake update
    nix flake check

# 処理途中のテンプレートを取り込まないため、Dependabot PR が残っていれば止める（adr/from-template/0006）
_template-settled:
    #!/usr/bin/env bash
    set -euo pipefail
    [ -z "${SYNC_IGNORE_OPEN_PRS:-}" ] || exit 0
    open=$(gh pr list -R Hol1kgmg/claude-temp --author app/dependabot --state open --json url,title -q '.[] | "\(.url) \(.title)"') \
        || { echo "gh でテンプレートの PR を確認できない。gh auth login するか、SYNC_IGNORE_OPEN_PRS=1 で無視する" >&2; exit 1; }
    if [ -n "$open" ]; then
        printf 'テンプレートに処理中の Dependabot PR がある。終わってから実行するか、SYNC_IGNORE_OPEN_PRS=1 で無視する:\n%s\n' "$open" >&2
        exit 1
    fi

# Merge template updates from upstream
sync: _template-settled
    #!/usr/bin/env bash
    set -euo pipefail
    git remote get-url upstream >/dev/null 2>&1 \
        || git remote add upstream https://github.com/Hol1kgmg/claude-temp.git
    git fetch --no-tags upstream main
    # 初回（共通祖先なし）はテンプレート生成由来の同一ファイルが全部 both added で衝突するため、
    # upstream 側を採用する。2 回目以降は独自変更を守るため通常マージ。
    # マージコミットであることが必須。squash / rebase すると共通祖先が失われ、
    # 次回以降ツリー全体が衝突する（adr/from-template/0001）
    if git merge-base --is-ancestor upstream/main HEAD; then
        echo "取り込む更新はない"
    elif git merge-base HEAD upstream/main >/dev/null 2>&1; then
        git merge upstream/main --no-commit --no-ff || scripts/resolve-locks.sh
        # 行単位のマージが衝突なしで通っても、両側の依存を合わせた lock が整合するとは限らない
        apm install
        git add apm.lock.yaml
        git commit --no-edit
    else
        git merge upstream/main --allow-unrelated-histories --no-edit -X theirs
    fi

# Open the template sync PR from template-sync
sync-pr: _template-settled
    #!/usr/bin/env bash
    set -euo pipefail
    [ -z "$(git status --porcelain)" ] || { echo "作業ツリーを clean にしてから実行する" >&2; exit 1; }
    orig=$(git branch --show-current)
    [ -n "$orig" ] || { echo "detached HEAD では実行しない。ブランチに切り替えてから実行する" >&2; exit 1; }
    git fetch --no-tags origin main
    git switch -C template-sync origin/main
    # 確認はこのレシピの依存で済んでいる
    SYNC_IGNORE_OPEN_PRS=1 just sync || {
        printf 'template-sync で止めた。解決して commit し、just _sync-pr-open を実行して %s に戻る\n' "$orig" >&2
        exit 1
    }
    if [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ]; then
        echo "取り込む更新はない"
        git switch "$orig"
        exit 0
    fi
    just _sync-pr-open
    git switch "$orig"

# Push template-sync and mark the sync PR ready
_sync-pr-open:
    #!/usr/bin/env bash
    set -euo pipefail
    [ "$(git branch --show-current)" = template-sync ] || { echo "template-sync ブランチで実行する" >&2; exit 1; }
    # upstream remote があると gh は origin より upstream を既定の repo に選ぶ
    export GH_REPO=$(git remote get-url origin | sed -E 's#(\.git)?$##; s#.*github\.com[:/]##')
    # template-sync は template-sync workflow が空コミットで作るブランチなので、毎回作り直す（adr/from-template/0006）
    git push --force origin template-sync
    case "$(gh pr list --head template-sync --state open --json isDraft -q '.[0].isDraft')" in
        true) gh pr ready template-sync ;;
        false) ;;
        *) gh pr create --base main --head template-sync --title "chore: テンプレートの更新を取り込む" \
            --body "**Create a merge commit** でマージする（squash / rebase は共通祖先を壊す。adr/from-template/0001）" ;;
    esac

# Lint workflows and dependabot.yml, and verify actions.lock against GitHub
lint-actions:
    jactionlint
    gh-actions-lock --verify

# Scan working tree for secrets
scan:
    gitleaks dir --verbose

# Scan staged changes for secrets
scan-staged:
    gitleaks protect --staged --verbose

# portless が worktree のブランチ名を前置するのは run のときだけ。リポジトリ名は worktree 内でも本体の .git から取る
# PORTLESS=0 でプロキシを通さず起動したときは PORT が渡されない
# Serve markdown at http://docs.<repo>.localhost:1355
docs *ARGS:
    portless run --name docs.{{file_name(parent_directory(`git rev-parse --path-format=absolute --git-common-dir`))}} sh -c 'markserv . -p "${PORT:-8080}" -a 127.0.0.1 --browser=false "$@"' _ {{ARGS}}

# Run all tests
test: fe-test be-test

# Run all linters
lint: fe-lint be-lint

# Format all code
format: fe-format be-format

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

# Start Storybook for shared UI components
fe-storybook:
    pnpm -C frontend storybook

# Run TypeScript type check
fe-typecheck:
    pnpm -C frontend typecheck

# Regenerate the Klee One subset for fixed UI text (adr/frontend/0005)
fe-font-subset:
    #!/usr/bin/env bash
    set -euo pipefail
    cd frontend
    out=src/app/styles/fonts
    node scripts/fixed-chars.ts > "$out/fixed-chars.txt"
    tmp=$(mktemp -d)
    trap 'rm -rf "$tmp"' EXIT
    # 再生成で字形が変わらないよう google/fonts のコミットを固定する
    base=https://raw.githubusercontent.com/google/fonts/130fcfb0ff422fec96b335616b2ca99f91914792/ofl/kleeone
    for pair in 400:Regular 600:SemiBold; do
        curl -fsSL "$base/KleeOne-${pair#*:}.ttf" -o "$tmp/font.ttf"
        pyftsubset "$tmp/font.ttf" --text-file="$out/fixed-chars.txt" --flavor=woff2 \
            --output-file="$out/klee-one-fixed-${pair%%:*}.woff2"
    done

# Regenerate the OG image (public/og.png) and the feed image base (backend/internal/feed/og-base.png) from docs/logo.svg
fe-og-image:
    cd frontend && node scripts/og-image.ts

# --- backend ---

# Start the API server (needs `just db-up`)
be-dev *args:
    cd backend && go run ./cmd/server {{args}}

# Regenerate oapi-codegen, sqlc, and frontend API types (openapi-typescript)
be-gen: be-gen-go
    pnpm -C frontend generate-api

# Regenerate oapi-codegen and sqlc only (CI checks the backend diff and has no Node.js)
be-gen-go:
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

# Subset Klee One SemiBold to the date characters for the feed image (backend/internal/feed/date-600.ttf)
be-og-font:
    #!/usr/bin/env bash
    set -euo pipefail
    tmp=$(mktemp -d)
    trap 'rm -rf "$tmp"' EXIT
    # fe-font-subset と同じコミットに固定し、サイトの日付と字形を揃える
    curl -fsSL https://raw.githubusercontent.com/google/fonts/130fcfb0ff422fec96b335616b2ca99f91914792/ofl/kleeone/KleeOne-SemiBold.ttf -o "$tmp/font.ttf"
    # x/image の opentype は woff2 を読めないので TTF のまま書き出す
    pyftsubset "$tmp/font.ttf" --text="0123456789月日()日月火水木金土" --output-file=backend/internal/feed/date-600.ttf

# Build and start db + migrate + api
be-up:
    docker compose up --build

# Start the API in compose pointed at the e2e GitHub mock (frontend/e2e/github-mock.mjs). Linux CI needs `--add-host=host.docker.internal:host-gateway`
be-dev-e2e:
    # 開発用の DB に書くとトップの「最新の Digest」が e2e のデータに置き換わるので、別の DB を使う
    docker compose up -d --wait db
    # 未来の日付は公開できない (specs/010) ので、前回の Digest より後の日付を毎回取れるよう空から始める
    docker compose exec db sh -c "dropdb -U times --if-exists --force times_e2e && createdb -U times times_e2e"
    DB_NAME=times_e2e GITHUB_CLIENT_ID=test GITHUB_CLIENT_SECRET=test ADMIN_GITHUB_LOGIN=octocat \
        GITHUB_BASE_URL=http://host.docker.internal:3100 GITHUB_API_URL=http://host.docker.internal:3100 \
        docker compose up --build api

# Serve the OpenAPI reference (Redoc) at http://api-docs.<repo>.localhost:1355
be-api-doc:
    redocly build-docs backend/api/openapi.yaml -o .cache/api-doc/index.html
    # PORTLESS=0 のフォールバックは backend の 8080 と被らないようにずらす
    portless run --name api-docs.{{file_name(parent_directory(`git rev-parse --path-format=absolute --git-common-dir`))}} sh -c 'python3 -m http.server "${PORT:-8090}" -b 127.0.0.1 -d .cache/api-doc'

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

# Load dev dummy data (backend/db/seed.md, dated relative to today, idempotent)
db-seed:
    cd backend && go run ./cmd/seed db/seed.md

# Run golang-migrate (e.g. `just db-migrate down 1`, `just db-migrate version`)
db-migrate *args:
    docker compose run --rm migrate -path /migrations -database "postgres://times:times@db:5432/times?sslmode=disable" {{args}}

# Create a migration pair: db/migrations/NNNNNN_<name>.{up,down}.sql
db-migrate-new name:
    docker compose run --rm migrate create -ext sql -dir /migrations -seq {{name}}

# Regenerate the ER diagram and table docs in docs/schema (view with `just docs`). CI checks the diff
db-doc: db-up
    tbls doc --rm-dist
