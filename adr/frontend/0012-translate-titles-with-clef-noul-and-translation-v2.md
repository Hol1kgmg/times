---
status: 'accepted'
date: 2026-11-08
decision-makers: 'Hol1kgmg'
---

# 記事タイトルは clef の noul で固有名称を決め、Cloud Translation v2 で翻訳する

## Context and Problem Statement

英語の記事タイトルを日本語で読めるようにしたい (issue #99、specs/012)。ただし固有名称 (React、TanStack Start、npm など) が訳されたり、大文字・小文字や記号が変わったりすると、何の記事か分からなくなる。崩れたタイトルを公開しないことが前提になる。

制約は次のとおり。

- 依存を足さない (constitution 原則 IV)
- clef (`@cf/cloudflare/clef`) の質問の型は `noul` (はい/いいえ)・`choice`・`score` だけで、文から語を抜き出す型がない
- Workers には `DOMParser` がなく、`HTMLRewriter` は Vitest とローカルで動かない (0010 と同じ事情)
- 翻訳の API キーはサーバーにだけ置く
- ローカルの vite dev には AI binding がない (0011)

比べた案は次のとおり。

- **抽出**: (A) 1〜3 語の候補を作って clef の `noul` で「固有名称か」を聞く / (B) テキスト生成モデルに JSON の配列で答えさせる / (C) 大文字始まりの語を正規表現で拾う
- **翻訳**: (D) Cloud Translation - Basic (v2) を API キーで呼ぶ / (E) Advanced (v3) をサービスアカウントで呼ぶ
- **守り方**: (F) 固有名称を `translate="no"` の span で囲んだ HTML を送る / (G) 固有名称をプレースホルダーに置き換えて送り、後で差し戻す

## Decision

**A・D・F を採る。**

- **抽出 (`extractTerms`)**: 空白で区切った語の前後の記号 (`:` `,` `(` `)` `"` `'` `!` `?`) を外し、1〜3 語の連なりのうち原文にそのまま現れるものを候補にする。候補ごとに `noul` の質問を作り、1 回の要求にまとめる。はいの確率が 0.5 以上の候補を、長い順に、位置が重ならないものだけ採る。候補は先頭から 64 個まで (clef の質問の上限) にする
- **翻訳 (`translateWithTerms`)**: v2 に `format: "html"`、`source: "en"`、`target: "ja"` で送る。API キーは Workers のシークレット `GOOGLE_TRANSLATE_API_KEY` を `process.env` から読み、クエリの `key=` ではなく `X-Goog-Api-Key` ヘッダーで渡す。クエリだと URL ごとログに残るため
- **守り方**: 固有名称を `<span translate="no" class="notranslate">` で囲み、それ以外を HTML としてエスケープする。前後が文字・数字の所は語とみなさない (`Google` の中の `Go` を囲まない)。返った HTML から span だけを外し、`<` が残れば失敗とする。v2 は訳の本文の文字参照を必ず二重にエスケープして返す (2026-11-08 に実際のキーで確認) ので、文字参照は 2 回戻す。戻した後に固有名称がすべて大文字・小文字・記号まで原文どおり含まれなければ失敗とし、タイトルに適用しない。原文より多く出てくる英単語がある結果も失敗とする (下の More Information)
- **再試行**: clef と翻訳は、通信の例外と 5xx だけを最大 3 回まで試す。4xx は繰り返しても結果が変わらないので再試行しない
- **ローカル開発**: 翻訳しない。ボタンは `import.meta.env.DEV` で押せなくし、サーバー側も clef が無ければ `null` を返す。固有名称を守れないまま翻訳しないため
- **分け方**: 抽出と翻訳は別の関数にし、サーバー関数 `translateTitle` は 2 つを順に呼ぶだけにする。翻訳が要るかの判定は持たず、#105 の自動実行が呼び出し側で挟む
- **画面**: 翻訳ボタンは記事の編集モーダルのタイトル欄の右端に置き、結果は欄に入れるだけにする。「確定」で既存の `editLink` を通るので、`initial.title` は変わらず、登録前なら「変更を戻す」で原文に戻る。原文は保存しない

採らなかった理由は次のとおり。

- B は崩れた JSON や原文にない語を返し得て、検証とパースが増える。C は `npm`・`htmx` のような小文字の名前を落とし、文頭の `Building` を拾う
- E は API キーを受けず、Workers で JWT を RS256 で署名してトークンを取る処理が要る。使うのは 1 日約 10 件で、v3 の機能 (Glossary、Translation LLM) を今は使わない
- G は語が文から消えるので、`with React and TypeScript` が `with and` になって訳の質が落ちる。F は実際のキーで 6 件を送り、固有名称がすべて残ることを確かめた
- HTML パーサーの依存は、外すタグが自分で組んだ 1 種類だけなので要らない

## Consequences

- Good, because 依存を足さず、clef 1 回と翻訳 1 回で 1 件が終わる。clef の入力は $0.24/M token、翻訳は 1 件 100 文字前後で、1 日約 10 件なら費用は無視できる
- Good, because 固有名称が崩れた結果は確認で落ちるので、失敗が公開されることはない
- Bad, because 判定はローカルで確かめられず、本番にデプロイしてから確かめることになる。プレビューの host では管理者のログインが通らない (OAuth の callback が本番の host だけ)
- Bad, because 原文に `&amp;` という文字そのものを含むタイトルは、戻しすぎて `&` になる。技術記事のタイトルにはまず出ないので、`ponytail:` コメントで残す
- Bad, because 65 個目以降の候補は聞かないので、長いタイトルの後ろの固有名称は守られず、訳されれば確認で失敗になり得る

## Implementation Plan

- **Affected paths**:
  - `frontend/src/shared/api/title-terms.server.ts` (`candidates`、`pickTerms`、`extractTerms`)
  - `frontend/src/shared/api/title-translation.server.ts` (`toHtml`、`fromHtml`、`translateWithTerms`)
  - `frontend/src/shared/api/translate-title.ts` (サーバー関数 `translateTitle`、`requireAdminToken`)
  - `frontend/src/shared/api/retry.server.ts` (`retry`、`RetryableError`)
  - `frontend/src/shared/api/workers-ai.server.ts` (clef の読み込み。0011 のカテゴリ推定と共有)
  - `frontend/src/shared/ui/icons/translate.tsx` (Material Design Icons の google-translate、Apache-2.0)
  - `frontend/src/pages/digest-editor/ui/draft-card.tsx` と `draft-card.module.css` (`EditDialog` のタイトル欄)
- **Pattern**: AI と外部 API の答えは Zod で `parse` する。#105 は `extractTerms` → (訳す語が残るかの判定) → `translateWithTerms` の順に呼ぶ
- **Secrets**: `GOOGLE_TRANSLATE_API_KEY` は Cloudflare のダッシュボードで管理する。GCP のコンソールで Cloud Translation API だけに制限する

### Verification

- [x] 候補の切り出し・重なり・しきい値 (`title-terms.server.test.ts`)、HTML の組み立てと戻し・大文字小文字の違い・想定外のタグ (`title-translation.server.test.ts`)、再試行 (`retry.server.test.ts`) が通る
- [ ] ローカルの `just fe-dev` で、編集モーダルの翻訳ボタンを押せない
- [ ] 本番で `Building Apps with React and TypeScript` を翻訳すると、`React` と `TypeScript` を含む日本語になる (specs/012 quickstart.md)

## More Information

- 2026-11-08 (本番の確認): `Stable Audio 3 on Apple Silicon (MLX) …` を訳すと、v2 は `Apple <span>Apple Silicon</span> （ <span>MLX</span> ）` のように、span の直前に語の頭の英単語を書き足し、span の外側と全角の文字の間に空白を足した。`fromHtml` で、span の外側と非 ASCII の文字の間の空白を消し、原文より多く出てくる英単語があれば失敗にした (`title-translation.server.test.ts` にこの返りを実例として置く)。この種のタイトルは「翻訳できませんでした」になり、手で直す
- 2026-11-08 (続き): 本番で失敗になったので、span の直前の英単語が span の語の頭と同じなら消す手当てを足した。複数語の語の空白を `-` でつないで送っても書き足しは残り (`Apple <span>Apple-Silicon</span>`)、短い文では起きなかったので、語の形ではなく語順の入れ替えが原因とみた。訳の後に clef で英語の取り残しを判定させる案は、確率の判定で正しく残った語 (`GPU`) まで落とし得て、英単語の数の比較で足りるので採らない。span の直前以外の書き足しは今までどおり失敗にする
- 2026-11-08 (続き): 本番では括弧が半角で返り (`( <span>MLX</span> )`)、全角の文字の隣だけを見る規則では空白が残った。開き括弧と span の間、span と閉じ括弧・句読点の間の空白も消す

## Revisit

- 用語を決まった訳にしたくなったら (Glossary)、この ADR を supersede して v3 に移す
- 固有名称の判定の外れが続いたら、質問の言い回しかしきい値 0.5 を直す
- `&amp;` を含むタイトルが出たら、送る前に印へ置き換える形に直す
- span の直前以外の書き足しで失敗するタイトルが多ければ、直し方を足す
