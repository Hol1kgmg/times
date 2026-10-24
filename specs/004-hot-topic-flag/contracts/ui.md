# Contract: 表示と登録画面

## トップの Digest (`pages/home/ui/digest.tsx`)

- 区画はカテゴリだけ。ホットトピックの記事も `groupByCategory` で本来のカテゴリに入り、登録順で並ぶ (`groupByCategory` は本機能で変えない)。
- `hot` の親の記事は、`<a>` の中のタイトルの直後に印 `<span class="hot"><Flame aria-hidden /><span class="hotLabel"><HotBubble /></span></span>` を出す。子記事には出さない。
  - `<a>` の中に置くので、`a + .preview` の隣接セレクタはそのまま効く。アイコンへのホバーもリンクへのホバーになる。
  - 炎と吹き出しはリンクの `mouseenter` / `focus` の間だけ `animate` で揺らす (`mouseleave` / `blur` で止める)。
  - 揺らすのは `matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)")` が真のときだけ。タッチ端末はタップでも `mouseenter` / `focus` が来るため、イベントの時点で判定する。
  - 吹き出し `icons/hot-bubble.tsx` は animate-ui のアイコンと同じ作りの SVG (viewBox 40×20、表示は 40×20px)。左側面の中央からしっぽが生えた角丸の四角を `currentColor` で塗り、中に `<text>HOT</text>` を置く。動きは上から下へ 1 回下がるだけ (`rotate: [-12, 0]`、0.25s easeOut)、軸はしっぽの先。
  - 読み上げは吹き出しの「HOT」に任せ (SVG は img「HOT」として出る)、炎は `aria-hidden` にする。リンクのテキストは「タイトルHOT」になる。

### 印の CSS (`digest.module.css`)

| 性質 | 値 |
|---|---|
| 色 | 炎は `--color-brand`。HOT は吹き出しで、地 `--color-brand` + 文字 `--color-on-brand` (#fff、ダークでも同じ) |
| HOT の吹き出し | SVG の塗りは `.hot` の `--color-brand` を受け継ぐ。`<text>` は `fill: var(--color-on-brand)`、`font-weight: 600` |
| 並び | `inline-flex`、高さ `1lh`、タイトルとの間と炎と吹き出しの間は `--space-half` |
| ホバーできる環境 | 吹き出しの外側 (`.hotLabel`) は `transform: scale(0)` + `opacity: 0` (起点は左端)。`.title:hover` / `.title:focus-visible` で `scale(1)` + `opacity: 1` へ移す。transform は 0.2s `cubic-bezier(0.34, 1.56, 0.64, 1)` (行き過ぎて戻る)、opacity は 0.1s。幅は普段から確保する |
| ホバーできない環境 | 動きなしで最初から吹き出しを出す (揺れもない) |
| 動きを減らす設定 | `transition: none` |

## 登録画面 (`pages/digest-new/ui/digest-new-page.tsx`)

- 「分類」の `<select>` は `category.options` から作るので 6 択になる (変更不要)。
- 「分類」の隣に `<label><input type="checkbox" name="hot-{i}">ホット</label>` を置く。新しい行は未チェック。checkbox は `accent-color: var(--color-accent)`。
- 送信データの各 item に `hot: boolean` を入れる。子には入れない。

## トップの説明 (`pages/home/ui/about.tsx`)

- `categoryDetails` からホットトピックを外す (`satisfies Record<Category, …>` が 6 値に追随を強制する)。
- FAQ「どうやって見ればいい？」の答え:
  「記事はカテゴリごとに並んでます。炎のアイコンが付いてるのは、その日いちばん盛り上がってたものです。押すと元のページが別タブで開きます。」

## テスト対応表

| 受け入れシナリオ | テスト |
|---|---|
| US1-1, US1-5, US2-3, US2-4, SC-002 | Playwright `digest-new.spec.ts`: 関連記事付きの 1 行に hot を付けて登録し、見出しがカテゴリだけ、リンクが登録順、`HOT` を含むリンクがその親 1 件だけ |
| US1-6 (読み上げ) | 同上: リンクのテキストが「タイトルHOT」 |
| US1-2〜4 (ホバー・タッチ・動き) | テストしない。CSS のメディアクエリと transition だけで、HTML / CSS の挙動のため (rules/quality.md) |
| US2-1 (6 択) | Vitest `schemas.test.ts` の既存「rejects a category outside the fixed set」に `ホットトピック` を入れる |
| US2-2, FR-003 (既定 off) | go test `TestToDigest`: hot の親と子を入れ、親は `hot: true`、hot でない親は `hot: false`、子に `hot` が出ない |
| US3 (移行) | quickstart の手動確認 (DB に接続するテストは書かない: constitution V) |
| seed の記法 | go test `cmd/seed/main_test.go`: `- 🔥 [t](u)` が hot として読まれる |
