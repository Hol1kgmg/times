---
status: 'accepted'
date: 2026-11-01
decision-makers: 'Hol1kgmg'
---

# ホバーのきっかけは react-aria の useHover で操作ごとに判定し、ホバー前提の UI を出すかはメディアクエリで決める

## Context and Problem Statement

ホバーは全箇所 `@media (hover: hover) { :hover }` で書いていた。`hover: hover` は主な入力装置だけを見るので、タッチパネル付きの PC ではタップでも `:hover` が付いて残り、色・記事プレビュー・ロゴや HOT の動きが出たままになる。

`any-hover` / `any-pointer` も端末が持つ入力を見るだけで、今の操作がどの入力かは分からない。`any-hover: hover` はハイブリッド端末で一致したうえ、主な入力がタッチの端末まで一致させるので悪化する。

ヘッドレス UI の導入 (#58) は React Aria Components (RAC) を第一候補にしており、RAC はホバーを `[data-hovered]` で表し、タッチを操作ごとに除外する。

## Decision

**ホバーの制御を 2 つに分ける。**

1. **きっかけ (今の操作をホバーとして扱うか)**: `react-aria` の `useHover` で判定し、`[data-hovered]` で CSS に渡す。`pointerType === "touch"` と、タップ直後の互換 mouse イベントを除外する。共通の入口は `shared/lib/use-hovered.ts`、`shared/ui/hover-button.tsx`、`shared/ui/hover-link.tsx`
2. **ホバー前提の UI を出すか (プレビュー、そのヒント、ロゴの文字や HOT を隠しておくか)**: `@custom-media --hover (hover: hover)` で決める。主な入力で既定の見せ方を決めるもので、`any-hover` は誤って一致する Android 端末で HOT やロゴの文字を見る手段がなくなるので使わない

- キーボードは従来どおり `:focus-visible` で、きっかけの判定とは独立させる。JS で動きを付ける箇所は `useFocusRing` の `isFocusVisible` を使う
- `react-aria` は hooks だけ先に入れる。RAC の部品は #58 のとおり date-picker を作り直すときに入れる
- 見送ったもの:
  - **`<html>` に直前の `pointerType` を属性で持たせ、CSS の `:hover` を残す**: 依存は増えないが、RAC を入れたときにセレクタを `[data-hovered]` へ書き換え直す
  - **`@media (any-hover: hover)`**: 上の Context のとおり

## Consequences

- Good, because タッチ付き PC でタップしてもホバーにならず、マウスで使えばホバーが効く
- Good, because ルールが「ホバー = `[data-hovered]`」「ホバー前提の UI = `@media (--hover)`」の 2 行になり、RAC の部品とセレクタが揃う
- Bad, because CSS だけで済んでいたホバー (サイドバー、ボタン、日付のセル) に JS が入り、ハイドレーションまではホバーの見た目が付かない
- Bad, because タッチ付き PC を画面のタッチで使っている間は、記事プレビューと HOT の吹き出しは出ない。意味は炎とリンク名で伝わる

## Implementation Plan

- **Affected paths**: `frontend/src/shared/lib/use-hovered.ts`、`frontend/src/shared/ui/hover-button.tsx`、`frontend/src/shared/ui/hover-link.tsx`、ホバーを持つ各 CSS Modules とその部品、`frontend/src/app/styles/global.css`、`rules/frontend-ui-design.md`
- **Patterns to avoid**:
  - CSS の `:hover` (タップで残る)。ホバーの見た目は `[data-hovered]` に付ける
  - `@media (hover: hover)` をきっかけの判定に使う。使うのはホバー前提の UI を出すかどうかだけ

### Verification

- [x] PC (マウス): サイドバー・ボタン・記事行のホバーで色が変わり、プレビューと HOT が出る
- [x] タッチ付き PC: 画面をタップしても色・プレビュー・HOT・ロゴの動きが残らない
- [x] スマホ: HOT の吹き出しとロゴの文字が最初から静止画で出る

## Revisit

RAC を入れたら、部品の付ける `[data-hovered]` に寄せ、`hover-button` / `hover-link` を置き換えられるか見直す。RAC は ADR 0008 で日付ピッカーの月表示から入れた。ADR 0009 でボタンとリンクを RAC の部品にし、`hover-link` は `router-link` (`createLink(RAC Link)`) に替えた。
