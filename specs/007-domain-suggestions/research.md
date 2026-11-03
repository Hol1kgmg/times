# Research: ドメイン候補

## R1. ドメインを保存せず、毎回 URL から求める

- **Decision**: `articles.url` から `substring(url from '^https?://([^/:?#]+)')` でホストを取り出し、クエリのたびに `GROUP BY` で数える
- **Rationale**: FR-009 (変更がすぐ反映される) を、同期の仕組みなしで満たす。記事は数百件規模で、全件を走査しても速さは問題にならない。`url` は CHECK `^https?://` で形が保証されている (migration 000004)
- **Alternatives considered**:
  - `domains` テーブル + FK: ドメインに属性がないうちは二重管理になるだけ (spec の範囲外)
  - `articles` に生成列 `host` + index: 件数が増えて遅くなったら足す。今は不要

## R2. 絞り込みは `strpos(lower(...), lower(q))`

- **Decision**: `sqlc.narg(q)` が NULL か空文字なら絞らない。それ以外は `strpos(lower(host), lower(q)) > 0`
- **Rationale**: `ILIKE '%' || q || '%'` では `q` の `%` / `_` をエスケープする処理が要る。`strpos` は文字どおりに比べるのでエスケープ自体が要らない (Edge Cases)
- **Alternatives considered**:
  - `ILIKE` + `replace` でエスケープ: 同じ結果のためにコードが増える
  - `pg_trgm`: 部分一致を index で速くする拡張。件数が少ないうちは不要

## R3. 入力の形は OpenAPI で弾く

- **Decision**: `q` は `maxLength: 100`、`limit` は `integer` / `minimum: 1` / `maximum: 50` / `default: 20`。validator が 400 (`validation-failed`) にする
- **Rationale**: quality.md「形式は openapi.yaml、handler で再検証しない」。`default` は oapi-codegen が値を埋めないので、handler で nil のときに 20 を使う (既定値の分岐はこの 1 か所だけ)
- **Alternatives considered**: handler で範囲を検査する案は quality.md に反する

## R4. 一覧の包みは `domains`

- **Decision**: `{ "domains": [{ "host": "zenn.dev", "count": 3 }] }`
- **Rationale**: 既存の `DigestList` (`digests`) に揃える。constitution の `{items: [...]}` との食い違いは 006 の plan で指摘済みで、改正は本機能の範囲外
- **Alternatives considered**: `items` にすると、同じ API の中で一覧の形が 2 通りになる

## R5. テストは router の 2 行だけ

- **Decision**: `TestRouter` に「未ログインの `GET /articles/domains` と `GET /articles/domains/all` は 401」、`TestBearerAuth` に「ログイン済みで `limit=51` は 400」を足す
- **Rationale**: quality.md「操作を足したら router テスト 1 件」「DB に接続するテストは書かない」。handler は sqlc の行を詰め替えるだけで分岐がない (既定値の 1 行を除く)。SQL の振る舞い (順序・絞り込み・ステータスを問わない) は quickstart の手動確認で見る
- **Alternatives considered**:
  - e2e 1 本: quality.md は「DB に読み書きする経路は e2e に 1 本」とするが、使う画面がまだない。サーバー関数を直接叩く e2e は「つながり」を確かめない。画面を作る機能で 1 本書く
  - Vitest で zod の境界: `z.number().int().min(1).max(50)` は自明な 1 行で、型と同じものを試すだけになる

## R6. パスは `/articles/domains`、operationId は `listArticleDomains`

- **Decision**: パスは返すものを表す名詞だけにし、使い道 (候補)・並び順・返す項目はパスに入れない。それらは `operationId` と `description`、query で表す
- **Rationale**: 返すのは保存されたドメインではなく記事の集計なので `/articles` の下に置く。後の記事検索 (`GET /articles?domain=`) の絞り込み候補として同じ下にまとまり、`/domains` はドメインに属性を持たせる実体のために空けておける。gin は静的な `/articles/domains` を後の `/articles/{id}` より優先する
- **Alternatives considered**:
  - `/domains`: 集計に使うと、後で `domains` テーブルを作ったときに意味が変わる
  - `/articles/domain-suggestions`: 使い道が UI に縛られ、ランキングなど別の用途で名前が嘘になる
  - `/articles/domains/search`: 絞り込みは `?q=` で表す。`q` がなければただの一覧
  - `/articles/domain-counts` / `/articles/top-domains`: 返す項目や並び順が変わると名前とずれる
  - 同じ記事の集計で中身の違うものが増えたら (日別の推移など)、`/articles/domains/timeline` のようにパスで分ける

## R7. サーバー関数はキャッシュを通さない

- **Decision**: `listDigests` と同じく、`backendFetch` に `token: requireAdminToken()` を渡し、キャッシュを通さない。公開分もログインが要るので同じにする
- **Rationale**: 管理者が記事を登録した直後の候補に反映される必要がある (SC-002)。管理者 1 人の呼び出しで、キャッシュの効果もない
- **Alternatives considered**: 公開分は誰が呼んでも同じ結果なのでトップと同じキャッシュ (adr/frontend/0002) を通せるが、ログインが要るうちは呼ぶ人が少なく効果がない。一般ユーザーが増えたら見直す

## R8. 公開分は別の操作にし、素直な名前を公開分に割り当てる

- **Decision**: 公開分を `GET /articles/domains` (`listArticleDomains`)、全件を `GET /articles/domains/all` (`listAllArticleDomains`) にする。どちらも `bearerAuth`
- **Rationale**:
  - 認証の範囲を操作ごとに OpenAPI で書け、handler で「誰が呼んだか」で返す範囲を変える分岐が要らない。分岐を誤ると下書きの記事のドメインが漏れる
  - 同じ URL が呼ぶ人で違う中身を返さないので、後で公開分にキャッシュを通せる
  - 後で多くの人が使うのは公開分なので、そちらに素直な名前を割り当てる。全件は `/digests/latest` と同じく、範囲を表す語を末尾に足して区別する (R6 の「同じ集計で中身の違うものはパスで分ける」の適用)
  - 007 は未コミットなので、全件を `/all` に移しても呼び手はいない
- **Alternatives considered**:
  - 同じ操作で、認証の有無やユーザーの種類で範囲を変える: OpenAPI に表れず、分岐を誤ると漏れる
  - `?status=published` の query: 値によって要る認証が変わることを OpenAPI で表せない
  - 公開分を `/articles/published/domains`、全件を `/articles/domains` のまま: 多くの人が使う方が長く特殊な名前になる

## R9. SQL は 1 本にし、公開分かどうかを引数で渡す

- **Decision**: `ListArticleDomains` に `sqlc.arg(published_only)::bool` を足し、`articles` を `digests` と結合して `NOT published_only OR d.status = 'published'` で絞る。handler の 2 つの操作は、引数だけ違う同じ処理を呼ぶ
- **Rationale**: クエリを 2 本にすると、sqlc が中身の同じ行の型を 2 つ作り、詰め替えも 2 つになる。ドメインの取り出し方・並び・絞り込みが 1 か所に閉じる
- **Alternatives considered**: クエリを 2 本に分ける: 正規表現と並びの条件を 2 か所で揃え続けることになる

## R10. 全件の経路の「管理者だけ」は、今はログインの確認で満たす

- **Decision**: 全件の経路にも `bearerAuth` だけを付ける。handler に `ponytail:` コメントで「一般ユーザーができたら管理者の判定を足す」と残す
- **Rationale**: セッションを発行するのは `ADMIN_GITHUB_LOGIN` に一致したときだけ (specs/003) なので、今はログイン = 管理者。使われない役割の判定を先に作らない (constitution IV)
- **Alternatives considered**: 役割の列や判定を今足す: 一般ユーザーの仕様が決まる前に形を決めることになる
