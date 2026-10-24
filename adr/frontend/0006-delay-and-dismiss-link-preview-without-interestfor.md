---
status: 'accepted'
date: 2026-10-24
decision-makers: 'Hol1kgmg'
---

# 記事プレビューの待ち時間と Esc での消去は CSS と小さな JS で作り、interestfor はまだ使わない

## Context and Problem Statement

トップの記事行は、リンクの `:hover` / `:focus-visible` で隣のプレビューカードを即座に出していた。2 つの問題があった。

- 一覧の上でポインターを動かすだけで、通り過ぎた行のカードが次々に一瞬出る
- カードはリンクの下の行を覆う。フォーカスで出たカードはキーボードで消す手段がなく、WCAG 1.4.13 (Content on Hover or Focus) の「消せること」を満たしていなかった

HTML の `interestfor` (Interest Invokers API、[ICS MEDIA の解説](https://ics.media/entry/260209/)) は、ホバー・フォーカスが続いてから popover を出し、Esc での消去やカード上へのポインター移動もブラウザが受け持つ。ただし 2026-10 時点で対応は Chrome / Edge 142 以降だけ。

## Decision

**`interestfor` は使わない。待ち時間は CSS の `transition-delay`、Esc での消去は `document` の `keydown` で作る。**

- 表示時だけ `opacity` と `visibility` を 0.3s 遅らせる (`@starting-style`)。`visibility` も遅らせるのは、透明なカードが下の行のクリックを奪わないようにするため。消すときは待たない
- データの取得は従来どおり `mouseenter` / `focus` で始める。待ち時間のうちに取得が進むため
- Esc でリンクに `data-dismissed` を付け、CSS の表示条件から外す。次の `mouseenter` / `focus` で外す
- 同じ記事で比べて見送ったもの:
  - **`interestfor` + 現行実装のフォールバック**: 表示の仕組みが 2 系統になる
  - **カードの上にポインターを移しても消えないようにする**: カードに押せる要素がなく、乗る理由がない
  - **`command` / `commandfor`**: dialog・popover をボタンで開閉する仕組みで、プレビューカードにはボタンがない

## Consequences

- Good, because 全ブラウザで同じ挙動になり、依存も増えない
- Good, because 表示条件は CSS のまま 1 か所に残る
- Bad, because 記事リンクごとに `document` の `keydown` のリスナーを 1 つずつ持つ。1 日分で数十件の規模なので許容する
- Bad, because `interestfor` が持つリンクとカードの関連付け (支援技術向け) は得られない。カードはリンクの直後の要素なので、読み上げの流れでは届く

## Implementation Plan

- **Affected paths**: `frontend/src/pages/home/ui/digest.tsx`、`frontend/src/pages/home/ui/digest.module.css`
- **Patterns to avoid**:
  - `display` に `transition-behavior: allow-discrete` で遅延を付ける (遅延の間に `@starting-style` が効かず、フェードしない)

### Verification

- [x] PC: 一覧の上を素早く通り過ぎてもカードが出ず、止まると 0.3s 後にフェードで出る
- [x] PC: ホバー中・フォーカス中に Esc でカードが消え、ホバーし直すと再び出る

## Revisit

Safari と Firefox が `interestfor` に対応したら、この ADR を supersede して置き換える。そのとき待ち時間・Esc・`data-dismissed` は消せる。
