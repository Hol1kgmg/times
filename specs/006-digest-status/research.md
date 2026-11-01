# Research: Digest の公開ステータス

## R1. ステータスは digests の text 列 + CHECK にする

- **Decision**: `digests.status text NOT NULL CHECK (status IN ('draft', 'published', 'private'))` を足す。既存の行は `ADD COLUMN ... DEFAULT 'published'` で埋め、同じ migration で `DROP DEFAULT` する。新しい行の値は handler が必ず渡す。
- **Rationale**: カテゴリ (`articles.category`) と同じ形で、固定値は DB の CHECK と OpenAPI の enum で縛る (品質ルール)。既定値をアプリ (`openapi.yaml` の `default: draft`) と DB の 2 か所に持つと食い違うので、DB には残さない。FR-010 は migration の `DEFAULT 'published'` で満たす。
- **Alternatives considered**: PostgreSQL の enum 型 — 値を足すときに `ALTER TYPE` が要り、既存の category と作りが揃わない。`published_at timestamptz` の有無で表す — 下書きと非公開を区別できない。

## R2. draft に戻せないことはスキーマで保証する

- **Decision**: 作成の `NewDigest.status` は `enum: [draft, published]` (`default: draft`)、更新の `DigestUpdate.status` は `enum: [published, private]` で省略可。どちらも任意。更新で `draft` を送ると kin-openapi の validator が 400 (`validation-failed`) にする。
- **Rationale**: 状態の移り方のうち禁止したいのは「draft へ戻す」だけで、それは「更新で draft を受け付けない」と同じ意味になる。今の状態を見ずに決められるので handler に分岐が要らない (FR-006、SC-004)。`draft` → `private` は許す (出さないと決めた下書きを片付ける) ので、これも今の状態を見る必要がない。
- **Alternatives considered**: 更新で 3 値を受け、handler で今の状態と比べる — スキーマで書けるルールを handler に書くことになる。ステータス専用の `PUT /digests/{entryDate}/status` — 記事の保存と公開が 2 回の要求になり、片方だけ成功しうる (FR-007)。boolean の `published` — `false` が下書きか非公開か読めない。

## R3. 更新の省略時は今のステータスを保つ

- **Decision**: `UpdateDigestDate` を `UpdateDigest` にし、`status = COALESCE(sqlc.narg(status), status)` を足す。日付・記事と同じトランザクションで更新する。
- **Rationale**: 下書きのまま記事を直すとき (US2-3) に、frontend は今の値を送らずに済む。1 本の UPDATE なので FR-007 の「一方だけ反映」が起きない。

## R4. 未ログインに見せるのは getLatestDigest だけ

- **Decision**: `GetLatestDigest` に `WHERE status = 'published'` を足す。`listDigests` と `getDigestByDate` に `security: [bearerAuth: []]` を付ける。どちらも管理画面からしか呼ばれていないので、frontend の `listDigests` / `getDigest` サーバー関数に管理者のトークンを渡す (`backendFetch` に切り替え、401 は既存の `SESSION_EXPIRED` に写る)。
- **Rationale**: FR-002、FR-003。ステータスで絞る条件を足すより、一覧と 1 件取得を閉じるほうが漏れる経路が残らない。specs/005 FR-004 / research R5 はこれで置き換える。
- **Alternatives considered**: 認証を任意にして、未ログインには公開だけを返す — 同じ操作で認証の有無により中身が変わり、テストと説明が倍になる。使う画面がない。

## R5. 登録後の行き先はステータスで分ける

- **Decision**: `createDigest` の成功時、`published` なら今どおり `/`、`draft` なら `/admin/digests` へ redirect する。
- **Rationale**: 既定が下書きになるので、今のまま `/` へ移ると登録した Digest が見えず、登録できたか分からない。公開で登録したときはトップで確かめられる今の動きを保つ (e2e `digest-new` の主経路もそのまま)。

## R6. 一覧の印は下書きと非公開にだけ付ける

- **Decision**: 日付一覧の日付の横に、`draft` なら「下書き」、`private` なら「非公開」を `.t-meta` の `--color-text-faint` で出す。`published` には何も付けない。
- **Rationale**: ほとんどが公開なので、全件にラベルを付けると一覧が読みにくくなる。印のない行が公開、という形で FR-009 を満たす。色は使わず (UI ルール: 有彩色はオレンジ 2 段だけ)、文字で区別する。
- **Alternatives considered**: 公開にも「公開」と付ける — 情報が増えない。ドットの印 — 選べない理由の型と紛らわしい。

## R7. 保存ボタンを分割ボタンにし、▼ で方法を選んでから押す

- **Decision**: 日付の横の `<select>` は置かず、送信ボタンを主ボタン + ▼ の分割ボタンにする。▼ のメニュー (`popover`) で保存の方法 (`saveActions`) を選ぶと、メニューが閉じて主ボタンのラベルが替わるだけで、保存は主ボタンを押したときに行う。先頭の方法 (登録は下書き、編集は今のステータスのまま) を既定にする。主ボタンは全ラベルを同じ grid のセルに重ね、選んでいないものを `visibility: hidden` にして、いちばん長いラベルの幅を常に取る。
- **Rationale**: ステータスの決定を保存の操作の隣に置き、既定ではステータスを変えないのでうっかり公開しない。メニューで選んだ時点で保存すると押し間違えが取り消せないので、選ぶと保存するを分ける (ユーザーの判断)。ラベルで選び直してもボタンの位置が動かない (UI ルール)。編集で今のステータスのままなら `status` を送らない (R3)。
- **Alternatives considered**: 日付の横の `<select>` — ステータスが保存ボタンから離れ、公開を選んだまま保存しやすい。メニューで選んだら即保存 — 押し間違えで公開される。
