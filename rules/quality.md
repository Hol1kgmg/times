# 品質ルール (バリデーションとテスト)

方針の上位は constitution 原則 V (品質はテストとスキーマで判断する)。ここでは「どの層で何を検証し、どの層にどのテストを書くか」を決める。手元での実行方法は docs/testing.md。

## バリデーションの置き場所

検証済みの値を同じ信頼境界の内部で同じ契約に照らして再検証しない。各層は自分の責務だけを持ち、信頼境界ごとの検証は省略しない。

| 層 | 検証するもの | 手段 | 書かないもの |
|---|---|---|---|
| DB | 整合性の最終防衛線: NOT NULL、CHECK (空文字・固定値)、UNIQUE、FK | `db/migrations/*.sql` | アプリの都合の値 (表示順など) |
| backend | リクエストの形式: 型、必須、enum、format、minItems、認証 | `openapi.yaml` のスキーマ。kin-openapi の validator が自動で 400 / 401 にする | handler 内の手書きの形式チェック |
| backend handler | 形式では表せない業務ルール: 重複、状態遷移、DB 制約違反の 400 への写し替え | `apperr.*` を返す | 形式の再検証 |
| frontend サーバー関数 | backend へ渡す前の入力の形、レスポンスの形 | `.validator(z.object(...))` と `schemas.ts` の `parse` | 業務ルール (backend の責務) |
| frontend UI | 入力補助: 必須、型、長さ、選択肢、項目間の整合性 | HTML 属性 (`required` / `type` / `maxLength` / `<select>`) を優先し、表せない検証には Zod | HTML 属性で足りる検証の JS 実装・独自エラー文言 |

### ルール

- **信頼境界は 2 つ**: ブラウザ → サーバー関数 (zod)、サーバー関数 → backend (OpenAPI)。両方を必ず通す。片方を「もう検証済み」として省かない。
- **UI の HTML 属性はユーザー体験のため**であり検証ではない。外しても backend が拒否する状態を保つ。
- **フォームの検証でサーバー関数の検証を省略しない**。Zod の適用範囲とスキーマ共有は [TypeScript アプリのルール](typescript-app.md#zod-の適用範囲) に従う。
- **enum と固定値は 1 か所で定義**する。backend は `openapi.yaml` の `Category`、frontend は `schemas.ts` の `category` (`satisfies` で生成型に縛る)。UI の `<select>` も `category.options` から作る。
- **DB の制約違反は handler で判別して 400 にする**。pgx の `*pgconn.PgError` で `23505` (unique) / `23514` (check) を見て `apperr.ValidationFailed` を返す。500 のまま返さない。
- **エラー文言は backend の `detail` をそのまま UI に出さない**。UI は「何を直せばよいか」だけを短く出す。
- **サーバー関数の返り値は `schemas.ts` の `parse` を通す** (adr/frontend/0001)。`res.json()` をそのまま返さない。
- **ブランド型は `parse` でだけ付ける**。`as ItemId` 禁止。
- **誰が使えるかは型で表す**。管理者専用の API は `AdminToken` (`requireAdminToken` が返す) でしか呼べず、管理者向けの UI は `AdminViewer` を受け取る部品に分ける。トークンはクライアントに渡さないので、`Viewer` には持たせない。

## テストの置き場所

| 種類 | 対象 | 置き場所 | 書く条件 |
|---|---|---|---|
| go test (unit) | 変換関数、エラー写像、認証ロジック | 対象と同じ package の `*_test.go` | 分岐・ループ・境界があるとき |
| go test (router) | OpenAPI 検証 (400 / 401)、Problem Details の形 | `cmd/server/main_test.go` | `openapi.yaml` に操作を足したとき 1 件 |
| Vitest | 純粋関数、zod スキーマの境界、サーバー関数のエラー変換 | 対象の隣の `*.test.ts` | 分岐・境界があるとき |
| Playwright | 機能どうしのつながりと、状態が次の操作に引き継がれること (登録 → 表示、ログイン → セッション → ログアウト) | `frontend/e2e/*.spec.ts` | つながりを新しく作ったとき 1 本 |

### ルール

- **1 ロジック 1 テスト**。壊れたら落ちる最小の 1 件を書く。正常 1 件と境界 1 件で足りるならそれ以上書かない。
- **自明な 1 行、型が保証するもの、HTML 属性だけの挙動はテストしない**。
- **DB に接続するテストは書かない** (constitution V)。handler のテストは sqlc の Queries をモックせず、変換関数とエラー写像を切り出して試す。DB を通す確認 (トランザクション、制約違反) は e2e が担う。CI で compose の `db` が動くようになったら見直す。
- **テスト名は仕様の言葉で書く**。`it("rejects a category outside the fixed set")` のように、何が守られるかを書く。実装名を書かない。
- **e2e はつながりにつき 1 本**。1 つの機能の中の分岐 (404、エラーの振り分け、表示の出し分け) は書かず、unit (zod / Vitest / go test) か型で押さえる。ただし SQL は e2e でしか通らないので、DB に読み書きする経路は e2e に 1 本残す。
- **ログイン状態を確かめる e2e は `admin-login` の 1 本だけ**。ほかの e2e はログインを前提 (`loggedInState`) に使うだけで、ログイン状態や未ログインの振る舞いを確かめない。画面 × ログイン状態の組み合わせで e2e を増やさないため。
- **テストのための export をしない**。テストしたいものが private なら、切り出して独立した関数にする。
- **モックは外部 I/O だけ** (GitHub、`fetch`)。自分のコードはモックしない。

## 完了の判定

変更を「できた」と言う前に、次がすべて通っていること。

```sh
just be-gen            # openapi.yaml か SQL を変えたとき。差分は同じコミットに含める
just lint && just test
just fe-typecheck
just fe-test-e2e       # サーバー関数と backend の受け渡し・SQL・セッションと Cookie に触れたとき
```

- e2e は変更に関わる spec だけを回す (`just fe-test-e2e <ファイル名>`)。登録とトップの表示のつながり (登録の送信・最新の Digest の取得) なら `digest-new`、編集の保存と読み直しなら `digest-edit`、ログイン・セッション・Cookie なら `admin-login`。画面の中の分岐・表示・見た目だけの変更では回さない
- e2e は backend を切り替えて回す。開発用 (`just be-dev`、DB `times`) と e2e 用 (`just be-dev-e2e`、DB `times_e2e`) は同じ 8080 を使うため、同時には動かせない。
  1. 開発用の backend が動いていたら止める (`lsof -iTCP:8080 -sTCP:LISTEN -P` で確認)。ユーザーが別のターミナルで動かしていて止められないときは、止めてもらうよう伝えて待つ
  2. `just be-dev-e2e` をバックグラウンドで起動し、`/health` が返るのを待つ
  3. `just fe-test-e2e`
  4. 結果に関わらず `docker compose stop api` で e2e 用を止め、1 で止めた開発用を `just be-dev` で起動し直す

- 新しい API 操作: `openapi.yaml` + sqlc クエリ + handler + router テスト 1 件 + `schemas.ts` のスキーマ。
- 新しい画面: route + page + サーバー関数 (zod)。e2e は新しいつながりを作ったときだけ 1 本。
- 新しい業務ルール: DB 制約 (可能なら) + handler のエラー写像 + そのテスト。
- テストが落ちたまま、または飛ばしたまま報告しない。落ちたら出力を添えて報告する。
