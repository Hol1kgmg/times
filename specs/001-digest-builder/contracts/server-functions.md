# Contracts: サーバー関数

この画面が呼ぶサーバー関数。backend の API (`backend/api/openapi.yaml`) は変更しない。

## `fetchDraftTitle` (新規)

`pages/digest-new/api/fetch-draft-title.ts`

| | |
|---|---|
| method | `POST` (外部 fetch を伴うので GET のプリフェッチ・キャッシュに乗せない) |
| 入力 | `z.url({ protocol: /^https?$/u }).max(2000)` (`newChildArticle.shape.url` と同じ) |
| 認可 | 管理者の Cookie がなければ `notFound({ data: { reason: SESSION_EXPIRED } })` |
| 出力 | `{ title: string \| null }`。取得できない・HTML 以外・5 秒超はすべて `null` |
| 副作用 | `shared/api/link-preview.server.ts` の Workers Cache を共有する (トップのプレビューと同じキー) |

## `createDigest` (既存、変更なし)

`pages/digest-new/api/create-digest.ts`

| | |
|---|---|
| 入力 | `newDigest` (`entryDate` + `items[]`: `category` / `hot` / `title` / `url` / `children[]`) |
| 成功 | `redirect({ to: "/" })` |
| 失敗 | セッション切れ: `notFound({ data: { reason: SESSION_EXPIRED } })`。backend 400 など: `Error` |

## `getLinkPreview` (既存、内部だけ変更)

`pages/home/api/get-link-preview.ts`。最新 Digest に載っている URL だけを受けるガードは残し、取得処理を `shared/api/link-preview.server.ts` の呼び出しに置き換える。入力・出力・キャッシュキーは変えない。
