# Quickstart: 記事タイトルの翻訳を確かめる

## 前提

- GCP のコンソールで Cloud Translation API を有効にし、Cloud Translation API だけに制限した API キーを作る。
- Cloudflare のダッシュボードで、Worker `times` のシークレットに `GOOGLE_TRANSLATE_API_KEY` を足す。
- 翻訳は本番でだけ確かめる。プレビューの host では管理者のログインが通らない (OAuth の callback が本番の host だけ)。ローカルの `just fe-dev` ではボタンを押せない (spec FR-012)。

## 自動の確認

```sh
just lint && just test   # 候補の切り出し・重なりの整理・HTML の組み立てと戻し・語の確認・再試行
just fe-typecheck
```

e2e は回さない。backend・DB・セッションに触れないため (`.agents/rules/quality.md`)。

## 手での確認 (本番)

1. 登録画面で、英語のタイトルの記事 (例: `Building Apps with React and TypeScript` の記事) を追加する。
2. 行のメニューの「編集」でモーダルを開き、タイトル欄の右端の翻訳ボタンを押す。欄の見出しの行に「翻訳してます」が出て、ボタンは押せなくなる。
3. 欄が日本語になり、`React` と `TypeScript` が原文の表記で残る (US1)。「確定」で候補のタイトルが日本語になる。
4. メニューの「変更を戻す」で、タイトルが英語の原文に戻る (US3)。
5. もう一度翻訳して確定し、登録すると、トップで日本語のタイトルが出る (US1 シナリオ 2)。
6. シークレットを一時的に消すか誤った値にして翻訳を押し、欄が変わらず「翻訳できませんでした」が出る (US2)。
