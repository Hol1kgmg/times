# Contract: 画面

## サイドバー (`app/layout/sidebar.tsx`)

- ログイン中のタブの「記事を登録」の直後に「記事を編集」(`<span class="hash">#</span>記事を編集`) を置き、`/admin/digests` へリンクする。未ログインには出さない (既存の `user &&` の中)。

## 日付一覧 `/admin/digests` (`routes/_shell/admin.digests.index.tsx` → `pages/digest-list`)

- `beforeLoad` は `resolveDigestNewPage` (管理者でなければ `notFound()`) を使う。`loader` は `listDigests` サーバー関数 (`GET /digests` → `digestList.parse`、キャッシュなし)。
- 見出し `<h1>記事を編集</h1>`。その下に日付を新しい順の `<ul>` で並べ、各行は `/admin/digests/$date/edit` への `<Link>`。日付は公開側の日付ピルと同じ書式 (`10月20日(火)`)。書式は `shared/ui/digest-post.tsx` の `dateFormat` を export して使う。
- 0 件なら「まだ Digest がないです」と出す (話し言葉の文言、UI ルール)。
- 見た目は UI ルールの「枠のグリッド」ではなく、通常面の上の 1px 線で区切った縦の一覧にする。新しいトークンは使わない。

## 編集画面 `/admin/digests/$date/edit` (`routes/_shell/admin.digests.$date.edit.tsx` → `pages/digest-new` の `DigestEditPage`)

- `beforeLoad` は `resolveDigestNewPage`。`loader` は `getDigest` サーバー関数 (`GET /digests/{entryDate}` → `digest.parse`、キャッシュなし)。`$date` が日付の形でない、または 404 なら `notFound()`。
- `DigestNewPage` を次の props で受ける形にし、`DigestEditPage` はそれを包む:

| prop | 新規登録 | 編集 |
|---|---|---|
| 見出し | 記事を登録 | 記事を編集 |
| 初期の日付 | 端末の当日 | 保存済みの日付 |
| 初期の board | `emptyBoard()` | `fromDigest(digest)` |
| 送信ボタン | 登録 | 保存 |
| 送信 | `createDigest` | `updateDigest({ date: 元の日付, digest })` |
| 成功時 | `/` へ redirect | `/admin/digests` へ redirect |
| 離脱確認 | 記事があれば | 開いたときの送信データと違えば (research R10) |
| 確認の文言 | 登録してない記事があります。このページを離れますか？ | 保存してない変更があります。このページを離れますか？ |

- 拒否の表示 (日付が登録済み、URL が登録済み、ログイン切れ、その他) は新規登録と同じ文言と位置。ログイン切れの文言の「登録」は「保存」に読み替える。

## 記事のメニュー (`pages/digest-new/ui/draft-card.tsx`)

- 「取得直後に戻す」(309 行、353 行) を「変更を戻す」にする。動き (`revert`) は変えない。

## テスト対応表

| 受け入れシナリオ | テスト |
|---|---|
| US1-1, US1-2, US1-4, US1-5, US1-6, US2-1 | Playwright `e2e/digest-edit.spec.ts` (1 本): 関連記事付き・ホット付きの Digest を新規登録 → サイドバー「記事を編集」→ 日付一覧で日付を選ぶ → 配置どおり並ぶことを確認 → タイトルを直し、記事を 1 件削除し、日付を未登録の日へ変えて保存 → 一覧に新しい日付があり古い日付がない → 新しい日付の編集画面に直した内容が並ぶ |
| US1-4, SC-002 | Vitest `board.test.ts`: `toNewDigest(fromDigest(d), d.entryDate)` が `d` の送信データと一致する (関連記事・ホット・複数カテゴリを含む) |
| US3-3 | Vitest `board.test.ts`: `fromDigest` した記事を `editLink` → `revert` すると保存済みの URL・タイトルに戻る |
| US1-9 | 既存の Playwright `digest-new.spec.ts` の未ログインのテストに、`/admin/digests` が 404 であることを 1 行足す |
| US2-2, US2-3, US1-7, US1-8, FR-011 | DB 制約 + handler の処理順 (data-model.md)。DB を通すテストは書かない (品質ルール)。quickstart で手動確認 |
| 形式違反・認証 | go router テスト 3 行 (contracts/openapi.md) |
| US3-1, US3-2, US3-4〜7 | 既存の `revert` のテストと、ラベルの差し替え (型・目視で足りる) |
