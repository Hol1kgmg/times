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

# Install frontend dependencies
install:
    pnpm -C frontend install

# Uninstall frontend dependencies
uninstall *args:
    pnpm -C frontend uninstall {{args}}

# Add frontend dependencies
add *args:
    pnpm -C frontend add {{args}}

# Add frontend dependencies
remove *args:
    pnpm -C frontend remove {{args}}

# Update frontend dependencies (`update` is reserved for nix locks)
upgrade *args:
    pnpm -C frontend update {{args}}

# Start the development server
dev *args:
    pnpm -C frontend dev {{args}}

# Start the development server bound to 0.0.0.0
dev-host *args:
    pnpm -C frontend dev:host {{args}}

# Build for production
build:
    pnpm -C frontend build

# Preview the production build
preview:
    pnpm -C frontend preview

# Generate TanStack Router route tree
generate-routes:
    pnpm -C frontend generate-routes

# Run unit tests
test *args:
    pnpm -C frontend test {{args}}

# Run E2E tests
test-e2e *args:
    pnpm -C frontend test:e2e {{args}}

# Run E2E tests with UI
test-e2e-ui *args:
    pnpm -C frontend test:e2e:ui {{args}}

# Run linter
lint:
    pnpm -C frontend lint

# Run markup linter
lint-markup:
    pnpm -C frontend lint:markup

# Format code
format:
    pnpm -C frontend format

# Run TypeScript type check
typecheck:
    pnpm -C frontend typecheck

# Deploy to Cloudflare Workers
deploy:
    pnpm -C frontend deploy

# Serve markdown at http://localhost:8080
docs *ARGS:
    markserv . -p 8080 -a 0.0.0.0 --browser=false {{ARGS}}
