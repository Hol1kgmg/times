---
status: 'accepted'
date: 2026-10-22
decision-makers: 'Hol1kgmg'
---

# 固定の UI 文字は Klee One のサブセットを preload して先に出し、記事タイトルの遅れは許容する

## Context and Problem Statement

トップをリロードするたびに、本文の文字が 0.3〜0.5 秒ほど空白になっていた。本番を回線を絞って撮影すると、ロゴと枠は出ているのに、説明文・日付・カテゴリ名・記事タイトルがまとめて遅れて出ていた。

原因は 2 つ重なっていた。

- `vite.config.ts` で fontsource の `font-display` を `block` にしている。`swap` だと Klee One が届いた瞬間に書体が切り替わってチラつくため。そのため、フォントが届くまで文字が描画されない
- fontsource は Klee One を `unicode-range` で 1 ウェイトあたり約 125 ファイルに分けている。トップだけで 39 ファイル (約 700KB) を読み、静的ファイルが `max-age=0, must-revalidate` (Workers の既定) で返るので、リロードのたびに 39 往復の 304 を待っていた

記事タイトルは登録のたびに変わり、どの漢字が出るか分からない。表示する文字だけのフォントをビルド時に作っても、新しい漢字はそのフォントに入らない。一方、説明文・見出し・FAQ・カテゴリ名・日付はソースに書かれた固定の文字列で、毎回同じ文字しか出ない。

## Decision

**固定の文字だけを含む Klee One のサブセット (`Klee One Fixed`) を preload し、`font-family` の先頭に置く。記事タイトルのように Fixed に無い文字だけが fontsource の Klee One に回り、その遅れは許容する。**

- body の既定は `--font-fixed` (`"Klee One Fixed", "Hiragino Sans", ...`)。データ由来の文字を出す要素 (記事タイトル、プレビューカード、入力欄) だけ `--font-dynamic` (`"Klee One Fixed", "Klee One", ...`) にする。書体は同じなので、遅れて届いても見た目は切り替わらない
  - 全体を `--font-dynamic` にしなかったのは、Chrome が書体指定・サイズ・太さの同じ文字をまとめて扱うため (2026-10-22)。記事タイトルと同じ 16px / 400 のサイドバーのリンクが、固定文字だけなのに記事用の Klee One の到着まで隠れていた。リンクだけ 15.5px にすると早く出ることで確かめた
- Fixed に入れる文字は、トップとシェルのソース (`src/app/**`・`src/pages/home/**`・`src/shared/**` の `*.{ts,tsx}`) のコメント以外に現れる非 ASCII 文字、ASCII 全体、日付の書式で使う `月日火水木金土`。`frontend/scripts/fixed-chars.ts` が抜き出し、`fixed-chars.txt` に書く
  - 当初は `src/**` 全体を入れていたが、トップに出ない管理画面の文言まで preload することになるので絞った (2026-10-25)。トップ以外の画面 (`pages/*` の home 以外) は、ページの一番外側を `--font-dynamic` にして Fixed に無い字を Klee One から取る。管理画面なので、記事タイトルと同じく Klee One の到着を待つ遅れは許容する。1 ウェイト約 71KB → 約 56KB
- 元のフォントは google/fonts の Klee One の TTF で、コミットを固定する。生成は `just fe-font-subset` (`pyftsubset`)。リポジトリには woff2 と文字の一覧だけを入れる
- Fixed も `font-display: block` にする。1 ウェイト約 63KB で、HTML と同時に preload するので待ち時間は短い
- `/assets/*` に `Cache-Control: public, max-age=31536000, immutable` を付ける (`public/_headers`)。ファイル名にハッシュが付くので、内容が変われば URL も変わる

## Consequences

- Good, because 固定の文字は 2 ファイルを取得すれば出る。600 の文字はすべて Fixed に入るので、600 の分割ファイルは読まれなくなった
- Good, because UI ルールの「フォントは Klee One」を変えずに済む
- Good, because immutable にしたことで、2 回目以降の訪問はフォントを含めて往復しない
- Bad, because トップ以外の画面を足すときに、ページの一番外側の `--font-dynamic` を付け忘れると、Fixed に無い字が端末のフォントで出る
- Bad, because トップかシェルの文言を変えたら `just fe-font-subset` が要る。忘れると Vitest (`fixed-chars.test.ts`) が落ちる。直さないまま出しても、増えた文字が遅れて出るだけで表示は崩れない
- Bad, because 記事タイトルは、Fixed にある英数字も含めて fontsource の到着まで空白になる。Chrome は読み込み中のフォントを使うテキストをまとめて隠すため
- Bad, because データ由来の文字を出す要素を足すときに `--font-dynamic` を付け忘れると、Fixed に無い字が端末のフォントで出る。隠れはしないが書体が混ざる。UI ルールに書いて防ぐ
- Bad, because ソース中の文字列を全部入れるので、画面に出ないエラー文の文字も含まれる。数十字の誤差なので構文解析まではしない

## Implementation Plan

- **Affected paths**: `frontend/scripts/fixed-chars.ts`、`frontend/src/app/styles/fonts/` (woff2・文字の一覧・テスト)、`frontend/src/app/styles/global.css`、`frontend/src/app/routes/__root.tsx` (preload)、`frontend/public/_headers`、`justfile` (`fe-font-subset`)、`flake.nix` (fonttools)
- **Dependencies**: devShell に `python3` + `fonttools` + `brotli` を追加。npm の依存は増やさない
- **Patterns to follow**:
  - preload には `crossOrigin: "anonymous"` を付ける。無いと CSS からの取得と別扱いになり、同じファイルを 2 回取得する
- **Patterns to avoid**:
  - 記事タイトルの文字をビルド時のデータから Fixed に入れる (登録のたびに再ビルドが要る)
  - Fixed を `swap` にする (block をやめた理由のチラつきが戻る)

### Verification

- [x] Vitest: ソースから抜き出した文字が `fixed-chars.txt` と一致する
- [x] `vite preview` で回線を絞った初回訪問: Fixed は preload の 1 回だけ取得され、固定の文字が記事タイトルより先に出る
- [x] 同じ条件でログイン中: サイドバーのリンク (`general`、`記事を登録`) が固定の文字と同時に出る
- [ ] 本番: `/assets/*` が `max-age=31536000, immutable` で返り、リロードで 304 が出ない

## Alternatives Considered

- **`swap` に戻し、代わりの端末フォントの字幅を `size-adjust` で寄せる**: 空白はなくなるが、書体の切り替わりは残る
- **日本語は端末のフォントにし、Klee One は英字だけにする (nani.now の方式)**: 最も軽いが、UI ルールの書体を変えることになる
- **Google Fonts の `text=` パラメータで動的にサブセットを取る**: 生成の手間はないが、表示のたびに外部に依存し、文言が変わると URL も変わる
