---
status: 'accepted'
date: 2026-11-08
decision-makers: 'Hol1kgmg'
---

# 記事のカテゴリは Workers AI の clef で推定し、ローカル開発では推定しない

## Context and Problem Statement

Digest の登録・編集では、追加した URL がすべて未分類に入り、管理者が 1 件ずつ箱へ振り分けていた (issue #86、specs/011)。推定は Workers AI の `@cf/cloudflare/clef` に `choice` 型の質問を投げれば、固定のカテゴリから 1 つ選ばせて確率を受け取れる。

問題は、AI binding (`env.AI`) が Workers の実行時にしかないこと。frontend のローカル開発は `vite dev` (Node) で動いていて、binding がない。取り方として 3 案を比べた。

- **A. `cloudflare:workers` を動的 import し、無ければ推定しない**: 本番だけで推定する。ローカルでは未分類に残る
- **B. REST API (`/accounts/{id}/ai/run`) をトークンで呼ぶ**: ローカルでも動くが、API トークンのシークレットが増える
- **C. `@cloudflare/vite-plugin` で dev も workerd で動かす**: ローカルでも binding が使えるが、dev の実行基盤が変わり影響範囲が大きい

## Decision

**A を採る。サーバー関数 `suggestCategory` の中で `await import("cloudflare:workers")` を呼び、失敗したら `null` (推定なし) を返す。**

- 推定は補助で、無くても未分類から手で振り分けられる (FR-007)。ローカルで推定されないことは仕様として受け入れる
- `cloudflare:` は vite の `resolveId` プラグインで external にし、build・dev・vitest のどれでも解決しようとさせない
- `probabilities[choice]` が 0.5 以上のときだけカテゴリを返す。`confidence` は定義が明らかでないので使わない
- 型は `cloudflare:workers` の `env` だけを手で宣言し、`@cloudflare/workers-types` は入れない (DOM の型と衝突し得るため)

## Consequences

- Good, because 依存もシークレットも増えず、dev の実行基盤も変わらない
- Bad, because 推定の挙動はローカルでは確かめられず、本番にデプロイしてから確かめることになる

## Implementation Plan

- **Affected paths**: `frontend/wrangler.toml`、`frontend/vite.config.ts`、`frontend/src/shared/api/category-suggestion.server.ts`、`frontend/src/shared/api/suggest-category.ts`、`frontend/src/pages/digest-editor/`

### Verification

- [x] 0.5 ちょうどで返り、0.49 と選択肢の外では `null` になる (`category-suggestion.server.test.ts`)
- [x] `vite dev` の SSR で呼ぶと、落ちずに `null` が返る
- [ ] 本番で AI 系の記事の URL を追加すると「AI系」の箱に入る (quickstart.md)

## Revisit

ローカルでも推定を確かめる必要が出たら (しきい値や `criteria` の調整を繰り返すなど)、この ADR を supersede して C に移す。
