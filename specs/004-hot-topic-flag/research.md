# Research: ホットトピックをカテゴリから記事のフラグへ移す

## R1. 印の持ち方

- **Decision**: `articles.is_hot boolean NOT NULL DEFAULT false` を列で持つ。
- **Rationale**: 印は 1 つだけで、値は真偽の 2 つ。列 1 つで足り、NOT NULL + DEFAULT で「省略したらホットではない」(FR-003) を DB が保証する。
- **Alternatives considered**:
  - タグ表 (`article_tags`) で多対多: 2 つ目の印がないので YAGNI (spec Assumptions)。
  - `digests` 側に「ホットな記事の id 一覧」を持つ: 記事の削除や再登録で整合が崩れやすく、FK で守れない。

## R2. 子記事の行の is_hot

- **Decision**: 子記事の行も親と同じ `is_hot` を持つ。API の `ChildArticle` には出さない。
- **Rationale**: 子の行は既に親の `category` を引き継いで持っている (handler.go の `insert`)。`is_hot` も同じ扱いにすれば、down migration で `is_hot = true` の行をまとめて `'ホットトピック'` に戻したとき、旧仕様 (子は親のカテゴリ) と一致する。
- **親子の不一致を防ぐ方法**: 検証は足さず、入力の形で表せなくする。OpenAPI の `NewChildArticle` / `ChildArticle` と zod の `newChildArticle` は `hot` を持たず、フォームの子の行にも checkbox を置かない。DB の値は handler の `insert` が親の値をそのまま渡す 1 経路だけで書く。
- **Alternatives considered**:
  - 子は常に false (親だけが持つ): DB を直接見ると「親 true・子 false」に見え、down migration で親子を JOIN して合わせる手間が増える。
  - FE・BE で「親子が一致するか」を検証する: 子の `hot` を送る場所がないので、検証する対象がない。
  - 子の未知の項目を 400 にする (`additionalProperties: false` / zod `.strict()`): `hot` 以外の未知の項目まで拒否するよう振る舞いが変わる。紛れ込んでも何も起きないので入れない。
  - 親子の一致を DB で強制する: CHECK は 1 行の中しか見られず、trigger が要る。`category` の一致も DB では守っていないので揃えない。

## R3. category の CHECK の張り替え

- **Decision**: 000006 で `articles_category_check` (000002 の列 CHECK に Postgres が付けた名前) を DROP → 既存行を UPDATE → 6 値で ADD する。
- **Rationale**: 先に UPDATE すると旧 CHECK は通るが、新 CHECK を先に ADD すると既存の `'ホットトピック'` 行で失敗する。DROP → UPDATE → ADD の順なら 1 トランザクションで済む (golang-migrate は 1 ファイルを 1 トランザクションで流す)。
- **Alternatives considered**: CHECK をやめて enum 型にする: 値の追加・削除のたびに型を作り直す手間が増える。今の CHECK 方式を変える理由がない。

## R4. 本来のカテゴリの訂正

- **Decision**: migration では一律 `'その他'` にし、本番は同じ日付の Digest を登録し直して正す。
- **Rationale**: 本来のカテゴリはデータから導けない。本番は 1 件だけなので、登録し直しで足りる (spec FR-010)。
- **Alternatives considered**:
  - migration に本番の URL ごとのカテゴリを書く: ローカルの seed や e2e の DB と食い違い、migration が環境に依存する。
  - 先に編集機能を作る: 移行の手順は変わらず、編集画面を 7 カテゴリのまま作って作り直すことになる。

## R5. 表示の組み立て

- **Decision**: 区画はカテゴリだけにし、`groupByCategory` は変えない。ホットトピックの記事は本来のカテゴリの中で、親の記事行に印を付けて示す。
- **Rationale**: 記事がカテゴリの中に残るので、「各記事はちょうど 1 回出る」(SC-002) を新しいロジックなしで満たせる。カテゴリの見通しも崩れない。
- **Alternatives considered**: 先頭にホットトピックの専用区画を置き、本来のカテゴリをタグで示す (当初の実装): タグが見づらく、記事がカテゴリから抜けて見通しが悪くなった (2026-10-24 に改めた)。

## R6. 印の見た目と動き

- **Decision**: タイトルの直後に炎のアイコンを `--color-brand` で出す。ホバーできる環境では、リンクのホバー・フォーカスの間だけ炎を揺らし、炎の横から「HOT」の吹き出しを `scale` で飛び出させ、揺らす。吹き出しは animate-ui のアイコンと同じ作りの SVG (`icons/hot-bubble.tsx`) で、左側面からしっぽが生えた角丸の四角を `--color-brand` で塗り、中に白の「HOT」を書く。ホバーできない環境では炎と吹き出しを最初から出す。
- **Rationale**:
  - 炎はトップの説明でホットトピックに使っていたアイコンで、意味がつながる。アイコンは `--color-brand` で、ホバーで動かす型は UI ルールに沿う。
  - 普段は炎だけ、ホバーで文字を出す形はサイドバーのロゴ (`variant="hover"`) と同じ。タッチ端末で文字まで静止画で出すのもロゴと同じ扱い。
  - 当初は HOT をオレンジの文字だけで `clip-path` で現していたが、目立たなかった。吹き出しにして地をオレンジで塗る。CSS (`::before` のしっぽ) ではなく SVG にしたのは、形を 1 本の path で決められ、炎と同じ仕組み (`animate`) で揺らせるため。動きの軸はしっぽの先にし、炎につながったまま動いて見せる。動きは上から下へ 1 回下ろすだけにする (往復する揺れは吹き出しには騒がしい)。地に橙を敷くのは UI ルールの例外で、ロゴのタイル (橙の地に白の Z) と同じ「小さな印」として扱う。
  - 白文字は橙の地で 2.8:1 と AA 未達だが、ホバー中の補助で意味は炎とリンク名でも伝わるので許容する。
  - 幅は普段から確保し、`scale` で見せる。幅ごと伸ばすと長いタイトルの折り返しがホバーのたびに変わる。
  - 印は `<a>` の中に置く。アイコンへのホバーもリンクのホバーになり、`a + .preview` の隣接セレクタも壊れない。
  - 炎は `animate` を state で制御する。`AnimateIcon asChild` で `<a>` を包むと、プレビュー用の `onMouseEnter` と合わさるかが Slot の実装に依存するため。
  - 読み上げは「HOT」の文字に任せ、炎は `aria-hidden`。`role="img"` は oxlint の `prefer-tag-over-role` に反する。`clip-path` で隠しても読み上げには残る。
- **Alternatives considered**:
  - 「HOT」の文字だけ: ロゴ色の小さな文字は白地で読みづらい。
  - 行の地を薄いオレンジにする: 強調面は 1 画面に 1 つまでで、ヒーローとぶつかる。
  - タイトルの文字色を変える: リンクのホバー色と見分けられない。

## R7. seed の記法

- **Decision**: 記事行の `- 🔥 [title](url)` を hot として読む。カテゴリ見出しは 6 つの名前だけになる。
- **Rationale**: 見出しは「何についての記事か」のまま保ち、印は行ごとに付くという本機能のモデルを Markdown でもそのまま表せる。正規表現に任意の接頭辞を 1 つ足すだけで済む。
- **Alternatives considered**: 「ホットトピック」見出しを残し、その下の記事を hot + 「その他」にする: 本来のカテゴリの中に印が付く表示を seed で確かめられない。

## R8. ホットトピックの説明の置き場所 (FR-008)

- **Decision**: FAQ の「どうやって見ればいい？」の答えに、炎のアイコンの意味を足す。`flame.tsx` は印に使う。
- **Rationale**: UI ルールは FAQ に「見方」を答えさせており、印の読み方は見方そのもの。カテゴリ一覧にホットトピックの枠を残すと、カテゴリの 1 つに見える。
