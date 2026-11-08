# Data Model: 記事のカテゴリを AI で推定して振り分ける

保存するデータは変えない (FR-006)。以下はクライアントの state とサーバー関数の入出力だけ。

## Draft (frontend/src/pages/digest-editor/model/board.ts)

| フィールド | 型 | 変更 |
|---|---|---|
| `suggested` | `boolean` | 追加。推定で箱に入ったら `true`、手で箱を移したら `false` |

子記事 (`Link`) には持たせない。子記事にしたときは消え、子記事から外したときは `false` で戻す。

### 状態の移り変わり

```text
addDraft            → 未分類, suggested=false
settleCategory(c)   → 未分類にあるときだけ: c の箱の末尾, suggested=true
                      (c が null / 既に未分類にない / 候補が消えた: 変えない)
moveToBoxEnd・fromIds (箱が変わった)  → suggested=false
fromIds (同じ箱で並び替え)              → suggested はそのまま
fromDigest・unmakeChild                → suggested=false
toNewDigest                             → suggested を出力に含めない
```

## カテゴリの推定 (サーバー関数)

- 入力: `{ url: string (http/https, newChildArticle.shape.url), title: string }`
- 出力: `Category | null`
- 判定: clef の答えの `choice` が `category` に含まれ、かつ `probabilities[choice] >= 0.5` のとき、その値を返す。それ以外は `null`。
