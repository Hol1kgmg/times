# Data Model: 記事登録 (Digest 作成) 画面

画面の state はすべてクライアントのメモリ上にある。操作は `pages/digest-new/model/board.ts` の純粋関数 (`Board` を受けて新しい `Board` を返す) にまとめ、UI は結果を `setState` するだけにする。

## 型

```ts
type BoxId = "未分類" | Category;             // Category は shared/api/schemas の category
type FetchState = "loading" | "done" | "failed";

interface Link {
  id: string;                                 // crypto.randomUUID()。送信時に捨てる
  url: string;
  title: string;                              // 取得失敗・取得中は ""
  initial: { url: string; title: string };   // 取得直後の値 (FR-017)
  status: FetchState;
}

interface Draft extends Link {
  hot: boolean;
  children: Link[];                           // 関連記事。最大 20、1 段まで
}

type Board = Record<BoxId, Draft[]>;          // キーの順 = 表示順 = 送信順 (未分類, 固定 6 カテゴリ)
```

`Link` が関連記事、`Draft` が記事。関連記事は `hot` と `children` を型として持たないので、2 段目以降とホット付きの関連記事は作れない。

## 関係

- 記事はちょうど 1 つの箱に属する。関連記事は箱に属さず、親の `children` にだけある。
- 箱の件数 (FR-010) は `board[boxId].length` (関連記事を数えない)。

## 状態遷移

- **status**: `loading` (URL 追加直後) → `done` (タイトル取得) / `failed` (取得できない・5 秒超)。`done` / `failed` になった時点で `initial` を確定する。編集・戻すは `status` を変えない。
- **記事 ↔ 関連記事**: `makeChild(board, id)` で記事 → すぐ上の記事の関連記事 (`hot` と空の `children` を捨てる)。`unmakeChild(board, parentId, childId)` で関連記事 → 親の直後の記事 (`hot: false`、`children: []`)。

## 操作と検証規則

| 関数 | 規則 (spec) |
|---|---|
| `addDraft(board, url)` | 未分類の末尾に `status: "loading"` で足す。重複 URL・記事 100 件超は拒否 (FR-007, FR-028) |
| `settleTitle(board, id, title \| null)` | 取得結果を反映し `initial` を確定。取得中に削除済みなら何もしない |
| `findDuplicate(board, url, exceptId?)` | 記事・関連記事のすべての URL と完全一致で比較 (FR-007、Edge Cases) |
| `canMakeChild(board, id)` | 箱の先頭でない・自分が関連記事を持たない・上の記事の関連記事が 20 未満 (FR-019) |
| `makeChild` / `unmakeChild` / `moveChild(board, parentId, childId, -1 \| 1)` | FR-019, FR-020 |
| `editLink(board, id, { url, title })` | 記事・関連記事のどちらも。重複なら拒否 (FR-016) |
| `revert(board, id)` | `url` / `title` を `initial` に戻す。箱・位置・`hot`・`children` はそのまま (FR-017) |
| `toggleHot` / `remove` | FR-018, FR-021 (削除の確認は UI 側) |
| `blockers(board)` | 登録を止める理由の一覧: カテゴリの記事 0 件 / 未分類あり / タイトル空 (関連記事を含む、該当 ID 付き) / 取得中あり (FR-024) |
| `toNewDigest(board, entryDate)` | 未分類を除き、カテゴリの固定順 → 箱内の順 → 関連記事の順に並べた `NewDigest` を返す (FR-023)。`blockers` が空のときだけ呼ぶ |

ドラッグでの移動は `move()` (dnd-kit) が `Record<BoxId, string[]>` を組み替えた結果を、ID から `Draft` に引き直して `Board` に戻す (research R2)。この写し替えも `board.ts` に置く。

## 送信データ

既存の `newDigest` (`shared/api/schemas.ts`) をそのまま使う。`toNewDigest` の結果はサーバー関数の `.validator(newDigest)` で検証される (constitution III / V)。
