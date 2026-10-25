# Quickstart: 記事登録 (Digest 作成) 画面の確認

## 前提

```sh
just db-up
just be-dev-e2e      # e2e と同じ backend (GitHub モック)
just fe-dev
```

管理者としてログインし (`/e2e-secret-login-path/auth/login` → 「GitHub でログイン」)、サイドバーの「記事を登録」を開く。

## 自動テスト

```sh
just lint && just test   # board.ts の Vitest、移した parse-link-preview の Vitest
just fe-typecheck
just fe-test-e2e         # e2e/digest-new.spec.ts
```

## 手動確認 (spec の受け入れシナリオとの対応)

| # | 操作 | 期待 | spec |
|---|---|---|---|
| 1 | 実在する記事の URL を 3 件、貼って Enter | 未分類に 3 件、タイトル・ドメイン・favicon 付き。取得中は入力欄が止まる | Story 1 |
| 2 | 同じ URL をもう一度 / `ftp://x` を入力 | 追加されず、その場に理由が出る | Story 1-4, 1-5 |
| 3 | 到達できない URL (`https://e2e.example/x`) | タイトル空の候補が追加され、手入力が要ると分かる | Story 1-6 |
| 4 | 候補をハンドルでカテゴリへドラッグ、カテゴリ間、未分類へ戻す、箱の中で入れ替え | 落とした位置に並び、見出しの件数が変わる | Story 2 |
| 5 | ハンドルにフォーカスして Space → 矢印 → Space | 4 と同じ移動がキーボードでできる | Story 2-8 |
| 6 | 箱の見出しで閉じて、閉じた箱へドラッグ | 見出しと件数だけ残り、末尾に入る | Story 2-7、Edge Cases |
| 7 | メニューで編集 → Esc / 確定、取得直後に戻す、ホット、削除 | spec どおり | Story 3 |
| 8 | 関連記事にする → 親をドラッグ → 上下 → 外す | 一緒に動く、外すと親の直後 | Story 4 |
| 9 | 未分類やタイトル空を残して登録 | 登録できず、理由と該当カードが分かる | Story 5-3〜5-6 |
| 10 | 全件分類して登録 | トップへ移り、配置どおりに表示される | Story 5-7 |
| 11 | 候補を残したままサイドバーで別画面へ / 再読み込み | 離脱確認が出る | FR-027 |
| 12 | 幅を狭くする | 左カラムが上、カテゴリが下に積まれ、操作できる | FR-002 |
