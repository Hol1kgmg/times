---
status: 'accepted'
date: 2026-11-02
decision-makers: 'Hol1kgmg'
---

# ヘッドレス UI は React Aria Components を採用し、日付ピッカーの月表示から置き換える

## Context and Problem Statement

状態 (ホバー・押下・フォーカス・選択) と振る舞い (キーボード操作・フォーカス管理) を部品ごとに自前で書いていた (#58)。中でも `shared/ui/date-picker.tsx` は、矢印キーでの移動、月をまたぐときのフォーカスの受け渡し、登録済みの日付を飛ばす処理を自前で持っていた。

候補は React Aria Components (RAC)、Ark UI、Base UI。導入の前に、今のルールとぶつかる 3 点 (キーボード、モーダル、日付の型) を決める必要があった。

## Decision

**React Aria Components を採用する。最初の部品は日付ピッカーの月表示 (`Calendar`) にする。**

- **キーボード**: 並んだ選択肢は WAI-ARIA の標準に寄せる。Tab で止まるのはグループに 1 つだけで、中は矢印キーで移る。選べない選択肢にも矢印キーでは止まり、選べないことを読み上げる
- **モーダル**: `<dialog>` の `showModal()` と `useModal` は残し、中身だけを RAC にする。RAC の `Modal` は `<dialog>` を使わず、`::backdrop` とフェードアウトの扱いを作り直すことになるため
- **日付の型**: RAC が使う `@internationalized/date` の `CalendarDate` は `date-picker.tsx` の中だけで使う。外向きの props は今の文字列 (`YYYY-MM-DD`) と Temporal のまま
- 年表示 (12 か月の一覧) は RAC に該当する部品がないので自前のまま。月表示との切り替えの view transition も自前で持つ。RAC の `focusedValue` を外から制御して、月をまたぐ移動を自前の月送り (滑らせる動き) に通す
- 見送ったもの:
  - **Ark UI**: 部品の構造と状態の名前は揃っているが、ADR 0007 の `useHover` (react-aria) と別系統になる
  - **Base UI**: Calendar がなく、今回の対象を置き換えられない

## Consequences

- Good, because 矢印キー・PageUp/PageDown・Home/End での移動と月をまたぐフォーカスの受け渡しを RAC に任せられ、自前の `keySteps` / `stepEnabled` / `pendingFocus` を消せた
- Good, because セルの状態が `[data-hovered]` / `[data-pressed]` / `[data-selected]` / `[data-unavailable]` になり、ADR 0007 のホバーと同じ属性で書ける
- Bad, because 選べない理由 (「登録済み」) を読み上げに足せなくなった。RAC のセルは読み上げのラベルを自分で作り、`aria-describedby` も通さないので、RAC 既定の「選べない」の読み上げで代える
- Bad, because 依存が 2 つ (`react-aria-components`、`@internationalized/date`) 増える。日付ピッカーは遅延読み込みなので、最初の表示には載らない

## Implementation Plan

- **Affected paths**: `frontend/src/shared/ui/date-picker.tsx`、`frontend/src/shared/ui/date-picker.module.css`、`frontend/src/shared/lib/month-days.ts`、`frontend/src/pages/digest-editor/ui/date-field.tsx`、`rules/frontend-ui-design.md`
- **Patterns to avoid**:
  - RAC の部品のホバー・押下に `:hover` / `:active` を使う。部品が付ける `[data-hovered]` / `[data-pressed]` に付ける
  - `CalendarDate` を `date-picker.tsx` の外へ出す
  - 週の始まりと読み上げを閲覧者のブラウザの言語に任せる。`I18nProvider locale="ja-JP"` で曜日の見出しと揃える

### Verification

- [x] 矢印キーで月をまたぐと、月送りと同じく滑ってフォーカスが行き先の日付に移る
- [x] 開いたとき、選択中の日付 (なければ今日) にフォーカスがある。Tab で止まるセルは 1 つだけ
- [x] 登録済みの日付はドットが付き、`aria-disabled` になる
- [x] 年表示との行き来、6 週ある月でダイアログの高さが変わらない
- [x] クリックと Enter で選ぶと閉じて、日付欄に入る

## Revisit

Select・Menu・Combobox などを新しく作るときは RAC の部品から作る。モーダルを RAC に寄せるかは、`<dialog>` で足りなくなったときに見直す。
