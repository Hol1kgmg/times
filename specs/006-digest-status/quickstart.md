# Quickstart: Digest の公開ステータス

## 前提

ローカルの DB・backend・frontend が起動し、管理者でログインできること (docs/admin-login.md)。導入前に Digest を 1 件以上登録しておく。

## 自動チェック

```sh
just db-up                  # 000010 を当てる
just be-gen                 # openapi.yaml と SQL を変えたので再生成。差分は同じコミットに含める
just db-doc                 # 列が増えたので ER 図を再生成 (CI が差分を見る)
just lint && just test      # go test (router) と Vitest (digestUpdate)
just fe-typecheck
just fe-test-e2e digest-new
just fe-test-e2e digest-edit
```

## 手動確認

| # | 操作 | 期待 | 対応 |
|---|---|---|---|
| 1 | migration を当てた直後にトップを開く | 導入前と同じ Digest が出る。日付一覧に印がない | FR-010, SC-003 |
| 2 | 未来の日付をステータスを変えずに登録 | 日付一覧へ移り「下書き」が付く。トップは 1 のまま | US1-1, US1-2 |
| 3 | 2 を編集画面で開き、「下書きのまま保存」でタイトルを直して保存 | 「下書き」のまま。トップは変わらない | US2-3 |
| 4 | 2 を「公開」にして保存 | 印が消え、トップに出る | US2-2 |
| 5 | 4 を開き直して ▼ を開く | 方法が「公開のまま保存 / 非公開にして保存」で、下書きにする方法がない。選んでも保存されず主ボタンのラベルだけ替わり、ボタンの位置は動かない | US2-4, FR-008 |
| 6 | 4 を「非公開」にして保存 | 「非公開」が付き、トップは 1 に戻る | US3-2 |
| 7 | 6 を「公開」に戻す | トップに出る | US3-3 |
| 8 | 管理者の Bearer で `PUT /digests/<日付>` に `"status":"draft"` (`backend/api/http/digests.http`) | 400 `validation-failed` | US3-4, SC-004 |
| 9 | Bearer なしで `GET /digests` と `GET /digests/<日付>` | どちらも 401 | US1-5, FR-003 |
| 10 | すべて下書きか非公開にしてトップを開く | 「まだ記事がない」表示 | Edge Cases |
