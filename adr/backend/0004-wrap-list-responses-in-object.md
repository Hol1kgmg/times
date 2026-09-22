---
status: 'accepted'
date: 2026-09-22
decision-makers: 'Hol1kgmg'
---

# 一覧応答はトップレベル配列ではなく object で包む

## Context and Problem Statement

`GET /items` はトップレベル配列 `[...]` を返していた。ページネーションはまだ無く、`SELECT * FROM items` を無制限に返している。

トップレベル配列には、後から `nextCursor` や `total` を足す場所が無い。ページネーションが必要になった時点で応答の形が変わり、破壊的変更になる。ページネーション自体は今要らないが、形だけは今決めないと後で高くつく。

## Decision

一覧を返す全ての操作は、配列を object で包んで返す。

```json
{ "items": [ ... ] }
```

- 配列のキーはリソース名の複数形（`items`）。`data` のような汎用名にしない
- ページネーションは実装しない。必要になったら **カーソル方式** で `nextCursor`（省略可）と query parameter `cursor` / `limit` を足す。offset 方式は採らない（`ORDER BY created_at DESC, id` の並びで、挿入されると offset がずれる）
- `ListItems` の SQL は無制限のまま。件数の上限が問題になった時点でカーソルを入れる

**Non-goals**

- `total` の返却。カーソル方式では count が要らない
- 一覧のフィルタ・ソート指定。必要になったときに query parameter で足す

## Consequences

- Good, because ページネーションを後から足しても既存クライアントが壊れない（`nextCursor` が増えるだけ）
- Good, because JSON のトップレベルが常に object になり、クライアントの型定義が揃う
- Bad, because 1階層深くなる。`res.items` と書く手間が増える
- Bad, because 無制限の一覧は件数に比例して遅くなる。今は items が少ないので受け入れる。`items.sql` に `ponytail:` コメントで上限を明記した

## Implementation Plan

- **Affected paths**: `backend/api/openapi.yaml`（`ListItems` の 200 を object に）、`backend/internal/handler/handler.go`（`ListItems200JSONResponse{Items: out}`）、`backend/api/http/items.http`
- **Dependencies**: 追加なし
- **Patterns to follow**: 新しい一覧操作は `required: [<複数形>]` の object を返す
- **Patterns to avoid**: `type: array` を操作の response schema のトップレベルに置く

### Verification

- [x] `openapi.yaml` の responses に `type: array` がトップレベルで現れない
- [x] `go test ./...` が通る（2026-09-22）

## Alternatives Considered

- **トップレベル配列を維持し、ページネーションが要る時に Link ヘッダで返す**（RFC 8288）。応答の形を変えずに済むが、`Link` ヘッダの parse をクライアントが実装することになり、JSON の中で完結する方が扱いやすい
- **今すぐカーソルページネーションを実装する**: 件数が少ない今は不要。形だけ決めておけば後から足せる

## More Information

- 再検討条件: 一覧のレイテンシが問題になったとき（カーソル実装のトリガー）
