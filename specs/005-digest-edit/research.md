# Research: 登録済みの Digest を編集する

## R1. 保存は全置換にする

- **Decision**: 1 トランザクションで `digests.entry_date` を更新し、その digest の `articles` を全削除 (`article_links` は `ON DELETE CASCADE` で消える) してから、`CreateDigest` と同じ手順で入れ直す。digest の `id` は保つ。記事の `id` は変わる。
- **Rationale**: 画面は記事の追加・削除・移動・親子の付け替えを自由に行うので、差分を取ると「どの記事がどれに対応するか」の突き合わせが要る。全置換なら新規登録の挿入処理をそのまま使える。記事の `id` を外から参照しているものはない (公開側は表示に使うだけ)。
- **Alternatives considered**: 記事ごとの差分更新 (PATCH) — 突き合わせと親子の付け替えの処理が増え、得るものがない。digest ごと削除して新規作成 — digest の `id` が変わり、一覧や URL がずれる。

## R2. 自分自身の URL を登録済み判定から外す

- **Decision**: 記事を全削除したあとに `ListRegisteredURLs` を呼ぶ。同じトランザクション内では削除済みの行は見えないので、自分の URL は自然に外れる。クエリに「除外する digest」の引数は足さない。
- **Rationale**: クエリを変えずに FR-008 を満たせる。訂正前の URL が登録済みでなくなる (Edge Cases) のも同じ仕組みで満たされる。
- **Alternatives considered**: `AND digest_id <> $3` を足す — 削除の前に判定するなら要るが、順序を変えれば不要。

## R3. 日付と URL の判定順

- **Decision**: 処理順を「日付の更新 → 記事の削除 → URL の判定 → 挿入」にする。日付の更新が `digests_created_by_entry_date_key` に違反したら、既存の `constraintViolation` が `digest-already-exists` にする。元の日付のまま保存しても自分自身の行なので違反しない (US2-4)。
- **Rationale**: 新規登録と同じ優先順 (FR-010)。エラー写像は既存のまま使える。
- **Alternatives considered**: 先に日付の重複を SELECT で確かめる — DB 制約と二重になる (品質ルール: 同じ検証を複数の層に書かない)。

## R4. 更新のキーは日付、他人の Digest と存在しない Digest は 404

- **Decision**: 更新は `PUT /digests/{entryDate}` にし、パスの日付 (今の日付) と body の `entryDate` (新しい日付) を分ける。`UPDATE digests SET entry_date = <新> WHERE created_by = <自分> AND entry_date = <今> RETURNING *` が 0 行なら 404 (`not-found`)。
- **Rationale**: gin は同じ位置に名前の違うパスパラメーター (`/digests/:entryDate` と `/digests/:id`) を置くと起動時に panic する。日付は管理者ごとに一意なのでキーに足りる。FR-011 の「存在しないものとして扱う」も同じクエリ 1 本で満たす。
- **Alternatives considered**: `PUT /digests/by-id/{id}` — URL の形が他の操作と揃わない。編集画面の URL も日付なので、日付をキーにすれば id を画面で持ち回る必要もない。

## R5. 一覧と 1 件取得は公開し、管理者で絞らない

- **Decision**: `GET /digests` (`{items: [{id, entryDate}]}`、新しい順) と `GET /digests/{entryDate}` は `security` なしにする。どちらも `created_by` で絞らない。1 件取得は `GetLatestDigest` と同じく `ORDER BY created_at DESC LIMIT 1` で 1 件に決める。
- **Rationale**: 載っている情報は公開ページと同じで、specs/002 の過去 Digest 一覧でもそのまま使う。管理者は 1 人なので、絞らなくても FR-003 の「ログイン中の管理者が登録した Digest」と一致する。書き込みの `PUT` は `created_by` で絞るので、他人の Digest は直せない。
  - ponytail: 管理者 1 人の前提。複数になったら一覧と 1 件取得に `created_by` の条件を足す (`GetLatestDigest` も同じ)
- **Alternatives considered**: 管理者専用の一覧 API を別に作る — specs/002 で公開版がまた要り、2 本になる。

## R6. `/digests/latest` と `/digests/{entryDate}` の共存

- **Decision**: そのまま両方を定義する。gin v1.12 は静的な経路をパラメーターより優先する (名前が同じパラメーターどうしなら共存できる。R4)。`entryDate` は `format: date` なので、`latest` が来ても検証で 400 になり取り違えない。
- **Rationale**: 既存の router テストの `GET /digests/latest` が 404 (`not-found`) のまま通ることで確認できる。

## R7. frontend の置き場所 (FSD)

- **Decision**: 編集画面は `pages/digest-new` スライスに同居させる。`DigestNewPage` を、初期値・見出し・送信先・離脱確認の条件を props で受け取る形にし、`DigestEditPage` として薄く包んで export する。日付一覧は新しいスライス `pages/digest-list` にする。
- **Rationale**: 編集画面は新規登録と同じ UI で、違いは初期値と送信先だけ (spec FR-005)。pages どうしの import は FSD で禁止なので、別スライスに分けると共通部分を `shared` へ下ろす大きな移動が要る。スライス名と中身の差 (new に edit が入る) は、名前を変えると import と e2e の参照が散るので今回は受け入れる。
  - ponytail: スライス名が `digest-new` のまま。編集以外の画面も足すときに `digest-form` などへ改名する
- **Alternatives considered**: `pages/digest-edit` を新設して UI を `shared/ui` に移す — `board.ts` や `draft-card.tsx` など 10 ファイルを動かすことになり、差分が大きい。

## R8. ルートのファイル名

- **Decision**: 一覧は `routes/_shell/admin.digests.index.tsx`、編集は `routes/_shell/admin.digests.$date.edit.tsx`。
- **Rationale**: `admin.digests.tsx` にすると TanStack Router が `admin.digests.new` と `$date.edit` の親レイアウトとして扱い、`<Outlet />` が無いと子が出ない。`index` にすれば兄弟のまま。

## R9. 編集画面の初期値と「変更を戻す」

- **Decision**: `board.ts` に `fromDigest(digest): Board` を足す。各記事を `category` の箱へ順に入れ、`status: "done"`、`initial` を保存済みの `url` / `title` にする。子記事も同じ。未分類は空。ラベルは `draft-card.tsx` の 2 か所を「変更を戻す」にする。`revert` は変えない。
- **Rationale**: `initial` に保存済みの値を入れれば、既存の `revert` がそのまま FR-016 の「編集では保存済みの値に戻す」を満たす。ホット・位置・親子を戻さない挙動も既存のまま (FR-017)。

## R10. 編集画面の離脱確認と保存後の遷移

- **Decision**: 離脱確認の条件は、新規登録では今のまま (`hasDrafts`)、編集では「`toNewDigest(board, entryDate)` が開いたときの値と違う」(`JSON.stringify` で比べる)。保存成功時は `updateDigest` サーバー関数が `/admin/digests` へ `redirect` を投げる。
- **Rationale**: `toNewDigest` は記事の `id` や取得状態を含まないので、保存内容が同じかどうかをそのまま比べられる。

## R11. 編集画面のデータ取得はキャッシュしない

- **Decision**: 一覧と 1 件取得は `cachedJson` を通さず、`backendFetchRaw` で毎回取る。
- **Rationale**: 保存直後に一覧や編集画面を開き直したとき、古い内容が出て上書きしてしまうのを防ぐ。公開トップのキャッシュ (5 分) は spec の Assumptions どおり残す。

## R12. e2e のデータ

- **Decision**: `digest-edit.spec.ts` は自分で Digest を 1 件登録してから編集する。日付は実行ごとに変える (遠い未来の日付に `Date.now()` 由来の日数を足す)。URL も `digest-new.spec.ts` と同じく実行ごとに変える。
- **Rationale**: e2e の DB は使い回すため、1 日 1 Digest と URL の全期間一意に当たらないようにする。
