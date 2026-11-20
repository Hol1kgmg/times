# 実装計画

backend と保存の形は変えない。specs/021 の `GET /articles/repost-candidates` を呼ぶサーバー関数と、編集画面の盤面に再掲載の行を足す関数、それを使うモーダルを足す。

## サーバー関数

- `shared/api/repost-candidates.ts` に `listRepostCandidates` を足し、`shared/api/index.ts` から出す。形は `search-articles.ts` と同じで、`requireAdminToken` で呼び、入力は `articleSearchQuery`、返り値は `repostCandidateList.parse` を通す。登録したばかりの記事も探せるよう、キャッシュは通さない (FR-001)。

## 盤面 (`pages/digest-editor/model/board.ts`)

- `repostBlock(board, candidate, entryDate): "not-before" | "on-board" | null` を足す (FR-004)。
  - `firstPublishedOn >= entryDate` なら `"not-before"`。`firstPublishedOn` は公開の掲載のうちいちばん古い日付なので、これが日付より前でなければ前の日付の公開の掲載もない (specs/018 FR-005)。
  - 親でも子でも盤面に同じ URL があれば (`findDuplicate`) `"on-board"`。
- `addRepost(board, candidate, id): Board | Rejected` を足す (FR-005〜007)。
  - 上限と重複は `rejectAdd` で断る。
  - 行は `convertToReposts` が作る再掲載の行と同じ形にし (`repost: { category, firstPublishedOn }`、`hot: false`、子なし)、元のカテゴリの枠に入れる。表示と制限は今の `DraftCard` がそのまま出す。
  - 子の候補も同じく単独の行にする (FR-006)。保存は `{ repostOf, category }` で送られ、読むときに親が呼び出される (specs/018 FR-004)。
- 日付を変えた後の判定はしない (FR-008)。保存で断られれば今の `unavailable` の印と案内が出る。

## モーダル (`pages/digest-editor/ui/repost-picker.tsx`)

- `ModalDialog` を使う。入力を持つので外側のクリックでは閉じない。
- 検索欄は素の `<input type="search">` に `required` と `maxLength={100}` を付けた `<form>` にし、送信で検索する。打つたびには呼ばない。空白だけの語はサーバー関数の zod で断られるので、そのときは語を入れるよう出す。
- 結果は React Aria Components の `ListBox` に並べ、選べない候補は `disabledKeys` に入れる。押すと `addRepost` して閉じる。
  - 行の中身はタイトル (favicon 付き)・URL のドメイン・カテゴリ・「〜に初掲載」。子なら親のタイトルを上に小さく出す。調査用の検索ページ (`article-search-page.tsx`) の行と似るが、選択の部品と中身が違うので共有しない (constitution IV)。
  - 選べない理由は、`--color-brand` のドットと、読み上げ用の文言 (「この日より前に公開されてないので選べません」「もう載ってるので選べません」) を `ListBoxItem` の中に置く (frontend-ui-design.md の「選べない理由」)。
  - 0 件なら「見つかりませんでした」。失敗はログイン切れとそれ以外を、今の保存の文言にそろえて出す。
- 開いたときは検索欄にフォーカスする。

## 画面 (`digest-editor-page.tsx`)

- `UrlAddForm` の下に「過去の記事から追加」のボタンを置く。日付が空 (FR-002) か上限 (FR-007) のときは押せない。
- 登録・編集の両方の画面で `DigestForm` に入るので、片方だけの実装は要らない。

## テスト

- Vitest (`board.test.ts`): `repostBlock` は、初掲載日が編集中の日付と同じなら選べず、前日なら選べる境界を 1 件、盤面の子の行にある記事を選べないことを 1 件。`addRepost` は、選んだ記事が元のカテゴリの枠で `{ repostOf, category }` として送られることを 1 件。
- e2e (`digest-repost.spec.ts`): 公開した記事を別の日の登録画面で検索して選び、公開して開き直すと再掲載の行として並んでいることを 1 本。1 回の実行で使う日付が 6 日から 8 日に増えるので、`dayFrom` の幅を `digest-edit.spec.ts` (1900 年から) に届かないよう `% 9_000` に詰める。
- 既存の URL を貼る流れ (SC-003) は既存の `digest-repost.spec.ts` の 1 本目で確かめる。

## Constitution Check

- I: spec → plan → tasks の順で進めている。
- II・III: API は変えず、backend はサーバー関数からだけ呼び、入力は zod で確かめる。
- IV: 新しい依存はない。React Aria Components と既存の `ModalDialog`・`rejectAdd`・`findDuplicate` を使う。複数ページで同じ部品にしない。
- V: FR は zod (入力・応答) と Vitest・e2e で押さえる。DB に接続するテストは書かない。

research.md・data-model.md・contracts は、新しい API もデータもなく判断がこのファイルで足りるので作らない (specs/021 と同じ)。
