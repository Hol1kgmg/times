# Data Model: 記事タイトルを固有名称を残して日本語に翻訳する

DB・OpenAPI・保存の形 (`toNewDigest`)・board の state は変えない。変わるのは記事の編集モーダルの state だけ。

## 翻訳の状態 (pages/digest-editor/ui/draft-card.tsx の EditDialog)

board の `Link` には足さない。記事の編集モーダルの state だけに持ち、モーダルを閉じると消える。

| 項目 | 型 | 意味 |
|---|---|---|
| `translation` | `"idle" \| "translating" \| "failed"` | 翻訳の状態。保存しない |

### 状態の移り方

| 契機 | 前 | 後 | タイトル欄 |
|---|---|---|---|
| 翻訳を押す | `idle` / `failed` | `translating` | 変えない |
| 翻訳の結果 (日本語) が届く | `translating` | `idle` | 翻訳結果に置き換える。ただし押したときの欄から変わっていたら置き換えない |
| 翻訳の結果が `null`、または例外 | `translating` | `failed` | 変えない |
| 欄を手で直す | `failed` | `idle` | 直したタイトル |
| モーダルを閉じる | — | — | 届いた結果は捨てる |

- 欄の値は「確定」で既存の `editLink` を通って候補のタイトルになる。`initial.title` は翻訳で変えないので、登録前の「変更を戻す」(`revert`) は翻訳前の原文に戻る (spec FR-007)。保存済みの記事の `initial.title` は保存したタイトルなので、保存後は日本語に戻る (spec US3 シナリオ 2)。
- `translating` の間はボタンを押せない (spec FR-009)。

## Link.translated (pages/digest-editor/model/board.ts)

一度翻訳した候補を重ねて訳さないための印 (spec FR-013)。`toNewDigest` には出さず、保存しない。`addDraft` と `fromDigest` では `false`。

| 契機 | 後 |
|---|---|
| 編集モーダルで翻訳を入れたまま「確定」(`editLink` に `translated: true`) | `true` |
| 翻訳した後に「やめる」 | 変わらない |
| `true` の候補を手で直して「確定」 | `true` のまま |
| 変更を戻す (`revert`) | `false` |
| 関連記事にする・外す | 引き継ぐ |

翻訳ボタンは、`Link.translated` か、そのモーダルで翻訳を入れた (`field.translated`) ときに押せない。

## 固有名称の候補 (サーバーの中だけ)

| 項目 | 型 | 意味 |
|---|---|---|
| `text` | `string` | 原文から切り出した 1〜3 語 |
| `start` / `end` | `number` | 原文の中の位置。重なりの判定に使う |
| `yes` | `number` | clef の `noul` の確率 |

- 選ぶ規則: `yes >= 0.5` の候補を、長い順に、既に選んだ候補と位置が重ならないものだけ残す。
- 語の前後の `:` `,` `(` `)` `"` `'` `!` `?` は外す。語の中の `.` `-` `/` `+` `#` は残す (`Next.js`、`C++`、`C#`)。

## 翻訳の結果 (サーバー関数の返り値)

`string | null`。`string` は確認を通った日本語のタイトル。`null` は翻訳しなかった (抽出の手段がない) か、確認を通らなかった。例外は再試行しても通信が失敗したとき。クライアントは `null` と例外を同じく `failed` にする。
