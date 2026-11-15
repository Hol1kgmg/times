# TypeScript アプリのルール

設定・型設計の知見を1セクション1ルールで追記する。公式ドキュメントへのリンクを添え、適用できない場合は利用側に理由を残す。

## erasableSyntaxOnly

- 設定: `tsconfig.json` の `compilerOptions` に [erasableSyntaxOnly](https://www.typescriptlang.org/tsconfig/erasableSyntaxOnly.html): `true`
- 適用条件: TypeScript 5.8 以降。
- 理由: `enum`・引数プロパティなど、型除去以外の変換が必要な構文を禁止する。
- 確認方法: 型チェック（`tsc --noEmit` など）をローカルと CI で実行する。

## Zod の適用範囲

- 方針: 外部データを受け取る境界で、内部処理に渡す前に [Zod](https://zod.dev/basics) で検証し、型は `z.infer` で導出する。
- 入力フォーム: HTML 属性による入力補助を優先し、項目間の整合性など、HTML 属性で表せない検証に Zod を使う。
- リクエスト: BFF などの受付処理で検証する。フォーム側で検証済みでも省略しない。
- API レスポンス・保存データ: API クライアントや repository などの取得処理で検証する。
- URL パラメータ・環境変数: それぞれの読み込み処理で検証する。
- 内部処理: 検証済みの型を受け渡し、同じ契約の検証を関数ごとに繰り返さない。
- スキーマ共有: 同じ制約は共有し、フォーム固有の入力表現や変換はフォーム用スキーマで扱う。
- 確認方法: 不正な入力を拒否するテストと型チェック。

## Zod と unique symbol でブランド型を定義する

- 定義: 型ごとに非公開の `const XxxBrand = Symbol()` を用意し、スキーマに [`.brand<typeof XxxBrand>()`](https://zod.dev/api#branded-types) を付ける。
- 型: `z.infer<typeof XxxSchema>` で導出する。
- 適用範囲: エンティティの ID は必須。金額・数量など、取り違えを防ぎたい値や、検証済みであることを関数の引数で要求したい値にも使う。
- 生成: `parse`・`safeParse` の成功結果を使う。型アサーションによるブランド付与は禁止する。
- 利用: 関数の引数・戻り値でもブランド型を維持する。
- 確認方法: 不正値の拒否と、異なるブランド間の代入エラーを確認する。

```ts
const PaymentAmountBrand = Symbol();
const PaymentAmountSchema = z.number().int().positive().brand<typeof PaymentAmountBrand>();
type PaymentAmount = z.infer<typeof PaymentAmountSchema>;
```

## Result 型の使い分け

- Result 型: 呼び出し側が、ほかのエラーと異なる対処をする失敗に使う。[公式の判断基準](https://praha-inc.github.io/byethrow/guide/best-practices/result-vs-throw)に従う。
- `null` / `undefined`: 正常な「値なし」を表す。
- 例外: 想定外の失敗・バグは例外として伝播させる。
- 実行環境: 個別に再試行を扱う通信失敗は Result 型、共通の障害処理に任せる失敗は例外とする。必須の環境変数の不足は例外として処理を止める。

## byethrow の運用

- 採用: Result 型は [`@praha/byethrow`](https://praha-inc.github.io/byethrow/) を使い、独自実装しない。
- import: `import { Result } from "@praha/byethrow"` に統一する。[公式ガイド](https://praha-inc.github.io/byethrow/guide/best-practices/importing-result)
- エラー型: 失敗理由を区別できる専用の型を定義する。[公式ガイド](https://praha-inc.github.io/byethrow/guide/best-practices/custom-error)
- 外部処理: 例外を投げる処理は、必要な箇所で `Result.fn` / `Result.try` により想定する失敗を Result 型へ変換する。未知の例外は伝播させる。[公式ガイド](https://praha-inc.github.io/byethrow/guide/tutorial/basics/wrapping-functions)
- 終端: `unwrap` で例外に戻すのは、フレームワークへ渡す境界に限定する。[公式ガイド](https://praha-inc.github.io/byethrow/guide/tutorial/resolving/unwrapping)

## 無視してよいエラー

- 判断基準: 原因が既知で、失敗しても仕様を満たす場合だけ、失敗を上位へ伝播させず処理を継続してよい。実行環境が原因であることだけでは、無視する理由にしない。
- 例: 不要になった取得処理の [明示的なキャンセル](https://dom.spec.whatwg.org/#aborting-ongoing-activities)、任意のプレビュー取得失敗、保存が制限された環境で仕様を満たすメモリ上の保持への切り替え。
- 処理: 対象を限定し、無視できる理由を1行コメントに残す。未知のエラーは再送出する。
