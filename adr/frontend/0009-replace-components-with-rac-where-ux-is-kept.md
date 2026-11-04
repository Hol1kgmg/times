---
status: 'accepted'
date: 2026-11-05
decision-makers: 'Hol1kgmg'
---

# 今の体験を保てる部品は React Aria Components に置き換え、保てないものは自前のまま残す

## Context and Problem Statement

ADR 0008 で React Aria Components (RAC) を入れたが、RAC の部品を使っていたのは日付ピッカーの `Calendar` だけだった。ボタン・メニュー・開閉・モーダルは、`HoverButton` / `HoverLink` / `popover="auto"` / `aria-expanded` / `<dialog>` で部品ごとに作っていた (#75)。

ADR 0008 では「モーダルは `<dialog>` を残す」「`CalendarDate` は `date-picker.tsx` の外に出さない」と決めていた。

## Decision

**今の仕様と UI / UX (見た目・動き・操作感・キーボード操作・フォーカス・読み上げ) を保てる部品だけ RAC に置き換える。** 保てないものは自前のまま残し、理由をここに書く。

| 部品 | 結果 |
|---|---|
| ボタン | RAC の `Button`。`:active` を `[data-pressed]` にした |
| リンク | RAC の `Link`。ルート内のリンクは `RouterLink` (`createLink(Link)`)。記事プレビューの表示・解除は今と同じ |
| メニュー (保存方法、記事の `···`) | `MenuTrigger` + `Popover` + `Menu` |
| 開閉 (FAQ、年の一覧、登録画面の箱) | `Disclosure` + `DisclosurePanel` |
| 日付欄 | `DateField`。ADR 0008 の「`CalendarDate` は `date-picker.tsx` の中だけ」を `date-field.tsx` にも広げる |
| モーダル (記事の編集、プレビュー、登録済みの確認) | `ModalOverlay` + `Modal` + `Dialog` (`shared/ui/modal` の `ModalDialog`)。ADR 0008 の「`<dialog>` を残す」を差し替える |

残したもの:

- **日付ピッカー** (`date-picker.tsx`、外枠の `<dialog>` を含む): 維持する判断。RAC の `Button` は押下の処理を click の中で行うので、月送りの `flushSync` と view transition の撮影のタイミングが変わる
- **テキスト入力**: RAC の `TextField` は `validationBehavior` が `native` でも `invalid` イベントを `preventDefault()` するので、ブラウザの入力ミスの吹き出しが出なくなる。移すには `FieldError` でエラー文を出す UI に変える必要がある
- **モバイルヘッダーの開閉**: `DisclosurePanel` の `hidden="until-found"` は、狭い幅でのページ内検索でメニューを開き、本文を `inert` にしてしまう。Esc・フォーカス・`inert`・幅での開閉も自前で残る
- **dnd-kit のハンドル**: `usePress` が pointerdown の伝播を止め、Enter / Space の keydown も扱うので、dnd-kit のセンサーとぶつかる
- **記事プレビューのカード**: RAC にホバーカードがない (ADR 0006)
- RAC の `RouterProvider` はつながない。記事リンクと RSS (server route) がクライアント遷移に巻き込まれる

## Consequences

- Good, because ホバー・押下・選択・開閉の見た目が RAC の付ける属性 (`[data-hovered]` / `[data-pressed]` / `[data-selected]` / `[data-expanded]` / `[data-entering]` / `[data-exiting]`) にそろった
- Good, because `HoverLink` を消し、メニューのフォーカス移動・モーダルのフォーカスの閉じ込めと戻しを自前で持たなくてよくなった
- Bad, because RAC の挙動に合わせて変わった点がある: モーダルとメニューを開いている間は背景のスクロールが止まる。メニューの外側を押すと閉じるだけで、押した先には届かない。押下の拡大がキーボードの Enter でも出る。押せる要素の上でダブルタップズームが効かない
- Bad, because `<dialog>` (日付ピッカー) と RAC の `Modal` の 2 つの作りが残り、`.modal` の動きも 2 系統になる

## Implementation Plan

- **Affected paths**: `frontend/src/shared/ui/{router-link,modal,modal.module}.*`、`frontend/src/pages/**/ui/*`、`frontend/src/app/styles/global.css`、`frontend/e2e/*`、`rules/frontend-ui-design.md`
- **Patterns to avoid**:
  - RAC の部品の状態に `:hover` / `:active` / `:popover-open` を使う
  - テキスト入力に `TextField` を使う (上の理由)
  - `RouterProvider` を足す

### Verification

- [x] `just lint && just test`、`just fe-typecheck`
- [x] `just fe-test-e2e` (`admin-login`、`digest-new`、`digest-edit`)
- [ ] 実ブラウザで、メニュー・開閉・モーダルの動きとフォーカスが今と同じに見える (PR のレビューで確かめる)

## Revisit

日付ピッカーを作り直すときに、外枠を `ModalDialog` に寄せる。テキスト入力のエラー表示を欄の下に出す UI にするなら `TextField` に移す。
