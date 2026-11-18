# Implementation Plan: 記事の再掲載と関連記事

**Branch**: `018-article-repost` | **Date**: 2026-11-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/018-article-repost/spec.md`

## Summary

`articles` を記事そのものに絞り、Digest への載り方 (並び・HOT・親子) を新しい `digest_articles` に移す。`article_links` は `digest_articles.parent_id` に吸収して消す (research R1・R2・R3、adr/backend/0008)。再掲載は同じ記事の 2 つ目の掲載で、保存時に「この Digest にまだ載っていない登録済みの記事」だけを純粋関数 `classifyReposts` で振り分ける。親で、新規の子があり、ほかの公開済み Digest に載っていれば通し、それ以外は今の `url-already-registered` か新しい `repost-needs-child` で断る (R4)。保存のレスポンスは `SavedDigest` (`repostedUrls` 付き) にし、再掲載があればサーバー関数が編集画面へ `?reposted=` 付きで戻して、記事行に「再掲載として登録しました」を出す (R6)。「〜に掲載」の日付は保存せず、読むクエリで導いて `Article.firstPublishedOn` として返す (R5)。公開ページではタイトルの下のメタ行に「再掲載」だけを、編集画面では `LinkMeta` に日付付きで出し、見た目は Storybook の story で確かめる (R7、contracts/ui.md)。

### Revision 2 (2026-11-18、research R14)

`digest_articles.is_repost` と、その CHECK・部分 UNIQUE (`digest_articles_original_key`) を 000013 から消し、再掲載を保存せずに導く。API の形 (`RepostArticle`、`Article.repost`・`firstPublishedOn`、`repostable`、`repost-unavailable`) は変えない。

- **SQL**: 掲載を読むクエリ (`ListArticlesByDigest`、`ListRegisteredArticles`) で、同じ記事のもっと前の日付の掲載 (状態を問わない) があるかを `is_repost` として導く。`first_published_on` は再掲載の行に限らず引く (元の掲載では前の掲載がないので NULL)。`placed_original` / `placed_repost` の 2 つの EXISTS は `placed` 1 つにする
- **handler**: `checkEntries` は、登録されていないか「この Digest に載っていて、前の掲載がない」記事だけを普通の親・子として通す。再掲載として送られた記事は、この Digest に載っていれば通し、載っていなければ `first_published_on` で FR-005 を確かめる。`toDigest` は再掲載の HOT を false にする。`CreateDigestArticle` から `is_repost` を消す
- **frontend**: 公開ページ (`DigestPost`) の印と細い行の条件を `repost` から `firstPublishedOn` の有無に替える。編集画面の行のロックは `repost` のまま
- **あわせて直すもの** (specs/018 のレビュー): 編集画面の子の HOT (親を HOT にしたら子の HOT を外す)、子のない再掲載のカテゴリ固定をドラッグの最中に掛けない、WebMCP のツールで再掲載を変えさせない、断られた理由で行の印を消し分ける、seed の 2 件、事実と違うコメント

## Technical Context

**Language/Version**: Go (backend)、TypeScript strict / React 19 (frontend)

**Primary Dependencies**: 既存のみ (oapi-codegen strict server、sqlc + pgx v5、golang-migrate、TanStack Start、Zod、Storybook)。依存は足さない

**Storage**: PostgreSQL 18。migration `000013_split_digest_articles`

**Testing**:
- go test: `classifyReposts` (子として入れた・公開の掲載がない・子がない・登録済みの子・通る、の境界)、`toDigest` (parent_id から親子を組む、`first_published_on` を親にだけ写す)、`apperr.RepostNeedsChild` の Problem の形
- Vitest: `rejection-of.ts` の `repost-needs-child`、編集 route の `reposted` の search の検証
- Playwright: `e2e/digest-repost.spec.ts` を 1 本 (公開済みの記事を親に、新しい記事を子にして保存 → 編集画面の案内 → トップで親子と印が出る)。DB を通る新しいつながりなので足す (quality.md)
- Storybook: contracts/ui.md の 6 story (見た目のデモ。自動テストではない)
- Revision 2: go test は `checkEntries` の表 (data-model の業務ルールの 2 つの表の行ごと) と `toDigest` の再掲載の HOT。Vitest は `board.ts` の子の HOT とカテゴリの固定、`DigestPost` の印の条件は純粋関数に切り出さず型と story で押さえる。e2e は `digest-repost` を回し直すだけで足さない (DB を通る経路は同じ)

**Target Platform**: Cloud Run (backend)、Cloudflare Workers (frontend)

**Project Type**: web (backend + frontend)

**Performance Goals**: 今と同じ。読むクエリは Digest ごとに 1 本 (今の `ListArticlesByDigest` + `ListArticleLinksByDigest` の 2 本を 1 本にする)

**Constraints**: 移行の前後で既存の表示を変えない (FR-015)。公開の判定は Digest の `status = 'published'` だけで行う

**Scale/Scope**: 管理者 1 人、Digest は 1 日 1 件、記事は 1 件 100 まで

## Constitution Check

| 原則 | 判定 | 根拠 |
|---|---|---|
| I. 仕様駆動 | ✅ | spec → plan → tasks の順。実装は承認後 |
| II. 契約ファースト | ✅ | 変更は `openapi.yaml` (contracts/openapi.md) と `db/queries/*.sql` から生成する。Problem は RFC 9457 のまま |
| III. サーバー関数経由 | ✅ | 経路は増えない。`reposted` の search は route の `validateSearch` で Zod 検証する |
| IV. 最小実装 | ✅ | テーブルを 1 つ足して 1 つ消す (差し引き 0)。リポジトリ層は置かない。並行保存の競合と、編集で再掲載を子へ動かす抜けは `ponytail:` で残す (R4) |
| V. テストとスキーマ | ✅ | 親子の同一 Digest は DB の複合 FK、記事の一意性は DB の unique、再掲載の振り分けは go test、拒否の変換は Vitest、DB を通るつながりは e2e 1 本 |

Phase 1 の設計の後も違反なし。

Revision 2: 再掲載の掲載の形 (親だけ・HOT なし・登録済みの URL を普通の親にしない) を DB の制約で守らなくなる (quality.md の「DB は整合性の最終防衛線」から外れる)。別の行の日付と比べる条件は CHECK・部分 UNIQUE で書けず、守るには状態を保存する必要があり、それが元の掲載のない記事を生んでいた (adr/backend/0008)。handler の判定と go test で守る。並行する保存は `LockDigestDates` で直列なので、判定と書き込みの間に他の保存は入らない。

## Project Structure

### Documentation (this feature)

```text
specs/018-article-repost/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── openapi.md
│   └── ui.md
└── tasks.md             # /speckit-tasks で作る
adr/backend/0008-split-articles-into-articles-and-digest-articles.md   # proposed。実装のマージで accepted にする
```

### Source Code (repository root)

```text
backend/
├── api/openapi.yaml                         # Article.firstPublishedOn、SavedDigest、repost-needs-child
├── db/migrations/000013_split_digest_articles.{up,down}.sql
├── db/queries/digests.sql                   # 掲載の読み書き、登録済みの判定、孤立した記事の削除。article_links のクエリを消す
├── db/queries/articles.sql                  # ListArticleDomains を記事の数で数える
├── internal/apperr/                         # RepostNeedsChild
├── internal/handler/handler.go              # insertArticles を書き直す、classifyReposts、toDigest
├── internal/handler/handler_test.go
└── cmd/seed/main.go                         # article_links から digest_articles へ

frontend/
├── src/shared/api/schemas.ts                # article.firstPublishedOn、savedDigest、problem の type
├── src/shared/ui/digest-post.{tsx,module.css,stories.tsx}      # 「再掲載」のメタ行と story
├── src/pages/digest-editor/api/{create,update}-digest.ts       # repostedUrls があれば編集画面へ
├── src/pages/digest-editor/api/rejection-of{,.test}.ts         # repost-needs-child
├── src/pages/digest-editor/model/board.ts                      # Draft に firstPublishedOn
├── src/pages/digest-editor/ui/link-meta.{tsx,module.css,stories.tsx}
├── src/pages/digest-editor/ui/{draft-card,digest-editor-page}.tsx  # reposted / needsChild を行へ渡す
├── src/app/routes/_shell/admin.digests.$date.edit.tsx          # validateSearch で reposted
└── e2e/digest-repost.spec.ts

packages/project/.apm/instructions/frontend-ui-design.instructions.md   # Digest の投稿の節に「再掲載」の印を足す
```

**Structure Decision**: 既存の backend / frontend の構成のまま。新しい slice は作らない。「再掲載 · 〜に初掲載」の文言は `LinkMeta` だけで使うが、日付の書式と同じ所に置くため `shared/lib/entry-date.ts` に `formatFirstPublished` を足す。

## Complexity Tracking

| 違反 | 必要な理由 | 退けた単純な案 |
|---|---|---|
| 再掲載の掲載の形を DB で縛らない (Revision 2) | 元の掲載かどうかは別の行の日付で決まり、CHECK・部分 UNIQUE で書けない | `is_repost` を保存して縛る: 元の掲載を外す・日付を変える・非公開にすると、元の掲載のない記事や元より前の再掲載が残る (research R14) |
