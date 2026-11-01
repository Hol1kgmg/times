# Contract: 画面

## 登録・編集フォーム (`pages/digest-new/ui/digest-new-page.tsx`)

- 送信ボタンを主ボタン + ▼ の分割ボタンにする (research R7)。▼ は `aria-label="登録方法を選ぶ"` / `"保存方法を選ぶ"`、メニューは `popover="auto"` (`draft-card.tsx` と同じ作り、アンカー名は `--save-menu`)。
- メニューの項目を選ぶとメニューが閉じ、主ボタンのラベルがその方法に替わる。保存は主ボタンを押したときだけ。選んでいる項目は `aria-pressed="true"` と選択の型 (`--color-accent` + 600) で示す。
- 主ボタンはいちばん長いラベルの幅を常に取り、選び直しても位置が動かない。押せないときは ▼ も押せない。
- 離脱確認の比較 (`isDirty`) は記事と日付だけで行う (方法の選択は変更に数えない)。

| 画面 | 今のステータス | 方法 (表示 → 送る値)。先頭が既定 |
|---|---|---|
| 登録 | - | 下書きで登録 → `draft`、公開して登録 → `published` |
| 編集 | draft | 下書きのまま保存 → 送らない、公開して保存 → `published`、非公開にして保存 → `private` |
| 編集 | published | 公開のまま保存 → 送らない、非公開にして保存 → `private` |
| 編集 | private | 非公開のまま保存 → 送らない、公開して保存 → `published` |

- 登録の成功時: `published` なら `/`、`draft` なら `/admin/digests` へ (research R5)。編集は今どおり `/admin/digests`。

## 日付一覧 (`pages/digest-list/ui/digest-list-page.tsx`)

- 日付のリンクの中、日付の後ろに `draft` なら「下書き」、`private` なら「非公開」を `.t-meta` (`--color-text-faint`) で出す。`published` は何も付けない (research R6)。

## サーバー関数

| 関数 | 変更 |
|---|---|
| `shared/api/list-digests.ts` | `readAdminToken()` を渡して `backendFetch` に。401 は `SESSION_EXPIRED` の notFound |
| `pages/digest-new/api/get-digest.ts` | 同上。404 は今どおり `notFound()` |
| `pages/digest-new/api/create-digest.ts` | 成功時の redirect 先を `data.status` で分ける |
| `pages/digest-new/api/update-digest.ts` | validator の `digest` を `digestUpdate` に |

## テスト対応表

| 受け入れシナリオ | テスト |
|---|---|
| US1-2, US1-4, US2-1, US2-2, US2-4 | Playwright `e2e/digest-edit.spec.ts`: 「下書きで登録」→ 日付一覧に「下書き」→ 編集で記事を直し、▼ で「公開して保存」を選んでから押す → 一覧の印が消える → 開き直すと方法が「公開のまま保存 / 非公開にして保存」。トップの切り替えは quickstart で確かめる (この spec は過去の日付を使う) |
| US1-1, US1-3 | Playwright `e2e/digest-new.spec.ts`: ▼ で「公開して登録」を選んでも画面は移らず、主ボタンを押すと登録され、今どおりトップで確かめる |
| US1-5, FR-003 | go test `TestRouter` (401 の 3 行) |
| US3-4, SC-004 | go test `TestUpdateDigestRejectsDraft` (更新で draft → 400) + Vitest `schemas.test.ts` (`digestUpdate` が `draft` を拒否) |
| US2-3, US3-1〜3, Edge Cases | quickstart の手動確認 |
