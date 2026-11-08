# Research: 記事タイトルを固有名称を残して日本語に翻訳する

## R1. 固有名称の抽出

- **Decision**: タイトルを空白で区切った語の 1〜3 語の連なり (n-gram) を候補にし、clef の `noul` 型の質問を候補ごとに 1 つ、1 回の要求にまとめて投げる。「はい」の確率が 0.5 以上の候補を固有名称とし、位置が重なる候補は長いほうを残す。
- **Rationale**: clef の質問の型は `noul` (はい/いいえ)・`choice`・`score` の 3 つだけで、文から語を抜き出す型はない (公式の schema-input.json)。候補をこちらで作って 1 つずつ「固有名称か」を聞けば、clef のまま抽出できる。1 回の要求に質問は 64 個まで入る。タイトルが 15 語なら 1〜3 語の候補は 15 + 14 + 13 = 42 個で収まる。出力 token は課金されず、入力は $0.24/M token なので費用は無視できる。候補は原文から切り出すので、「原文にない語」は構造上出てこない (spec FR-002)。
- **上限**: 候補が 64 個を超える長いタイトルは、先頭から 64 個だけ聞く (`ponytail:` コメントで上限を残す)。
- **Alternatives considered**:
  - Workers AI のテキスト生成モデルに JSON の配列で答えさせる案。崩れた JSON や原文にない語を返し得て、検証とパースが増える。
  - 大文字始まりの語を正規表現で拾う案。`npm`・`htmx` のような小文字の名前を落とし、`Building` のような文頭の普通の語を拾う。
  - jev。issue #99 の当初案だが、011 と同じく clef に揃える (spec Assumptions)。

## R2. 翻訳の API と認証

- **Decision**: Cloud Translation - Basic (v2、`https://translation.googleapis.com/language/translate/v2`) を API キーで呼ぶ。`format: "html"`、`source: "en"`、`target: "ja"`。キーは Workers のシークレット `GOOGLE_TRANSLATE_API_KEY` に置き、`process.env` から読む (`BACKEND_TOKEN` と同じ)。キーは GCP のコンソールで Cloud Translation API だけに制限する。
- **Rationale**: v2 は API キーを受ける。キーはクエリの `key=` ではなく `X-Goog-Api-Key` ヘッダーで渡す (クエリだとリクエストの URL ごとログに残るため)。Advanced (v3) は API キーを受けず、サービスアカウントの OAuth のアクセストークンが要る。Workers で使うには JWT を RS256 で署名してトークンを取る処理を書くことになる。使うのは 1 日約 10 件で、v3 の機能 (Glossary・Translation LLM) を今は使わない。
- **Alternatives considered**: v3 + サービスアカウント。署名とトークンの更新の処理が増える。Glossary が必要になったら移る。

## R3. 固有名称の守り方

- **Decision**: 固有名称を `<span translate="no" class="notranslate">…</span>` で囲んだ HTML を送る。それ以外の文字は HTML としてエスケープする。返った HTML からタグを外し、文字参照を戻した後、守った語がすべて大文字・小文字・記号まで原文どおりに含まれるかを確かめる。満たさなければ失敗とする (spec FR-004)。
- **Rationale**: 公式ドキュメントに書かれているのは「HTML のタグは訳さず、タグの間の文字だけを訳す」ことだけで、`translate="no"` と `class="notranslate"` は書かれていない。ただし語を文の中に残したまま送るほうが、訳の文脈が崩れない。効かなかった場合は後の確認で失敗として拾える (spec FR-004) ので、失敗が公開されることはない。
- **確認の結果 (2026-11-08、T002)**: 実際のキーで 6 件を送り、`React` `TypeScript` `TanStack Start` `Next.js` `npm` `Rust` `Go` `AT&T` がすべて大文字・小文字・記号まで原文のまま `<span translate="no" class="notranslate">` の中に残った。訳は `ReactとTypeScriptを使ったアプリ開発`、`npmは古いトークンを非推奨にしています` など。この方式で進める。
- **Alternatives considered**: 最初からプレースホルダー方式。語が文から消えるので、`with React and TypeScript` が `with and` になり、訳の質が落ちる。

## R4. 返った HTML の扱い

- **Decision**: 送るときは `&` `<` `>` `"` を 1 回だけエスケープする。返った HTML からは `<span …>` / `</span>` だけを正規表現で外し、その後に文字参照 (`&amp;` `&lt;` `&gt;` `&quot;` `&#NNN;` `&#xHH;`) を **2 回** 戻す。タグを外した後に `<` が残ったら失敗とする。固有名称の確認は戻した後に行う。
- **Rationale**: Workers には `DOMParser` がない。`HTMLRewriter` は Workers にしかなく、Vitest とローカルで動かない (adr/frontend/0010 と同じ理由)。入力の形を自分で決めているので、外す対象を限れる。T002 で確かめたところ、訳の本文の文字参照は、送り方 (`&` のまま、`&amp;`) によらず必ず二重にエスケープされて返った (`&` → `&amp;amp;`、`&lt;div&gt;` → `&amp;lt;div&amp;gt;`、`translate="no"` の中の `AT&T` → `AT&amp;amp;T`)。タグは二重にされない。
- **上限**: 原文に `&amp;` という文字そのものを含むタイトルは、戻しすぎて `&` になる。技術記事のタイトルにはまず出ないので、`ponytail:` コメントで残す。
- **Alternatives considered**: HTML パーサーの依存を足す案。外すのが 1 種類のタグだけなので不要 (原則 IV)。

## R5. 再試行

- **Decision**: clef の呼び出しと翻訳の `fetch` を、それぞれ最大 3 回 (初回 + 再試行 2 回) まで試す。再試行するのは、通信の例外と HTTP 5xx だけ。4xx (キーの誤り、クォータ超過の 403) は再試行しない。
- **Rationale**: spec FR-005。4xx は繰り返しても結果が変わらない。
- **Alternatives considered**: クライアントから再試行する案。往復が増え、失敗の扱いが 2 か所に分かれる。

## R6. 抽出と翻訳の分け方 (#105 との境界)

- **Decision**: サーバーの中に `extractTerms(title): Promise<string[]>` と `translateWithTerms(title, terms): Promise<string | null>` を置き、手動のサーバー関数 `translateTitle` は 2 つを順に呼ぶだけにする。判定は持たない。
- **Rationale**: spec FR-011。#105 は自動実行のサーバー関数で、かな・漢字の判定 → `extractTerms` → 訳す語が残るかの判定 → `translateWithTerms` と挟む。`force` のようなパラメータを足さずに済む。

## R7. ローカル開発でボタンを押せなくする方法

- **Decision**: クライアントで `import.meta.env.DEV` のときボタンを押せなくする。サーバー側でも、`cloudflare:workers` が無いときは `null` (翻訳しない) を返す。
- **Rationale**: spec FR-012。ローカルの vite dev には clef が無い (adr/frontend/0011)。`DEV` はビルド時に決まるので、可否を問い合わせるサーバー関数が要らない。
- **Alternatives considered**: 可否を返すサーバー関数を足す案。画面を開くたびに往復が 1 つ増える。

## R8. 翻訳ボタンのアイコン

- **Decision**: リポジトリ直下の `translate.svg` を `shared/ui/icons/translate.tsx` に写し、元のファイルは消す。塗りは `currentColor` のまま、`--color-brand` で塗る。動きは付けない。
- **Rationale**: 管理者の指定。`.agents/rules/frontend-ui-design.md` のアイコンの型は animate-ui だが、このアイコンには動きの定義がない。行の操作のボタンでホバーのたびに動く必要もない。
