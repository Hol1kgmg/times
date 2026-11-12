---
status: 'accepted'
date: 2026-11-12
decision-makers: 'Hol1kgmg'
---

# 閲覧者の権限は `kind` の文字列ではなく、照合で作るブランド型の値で表す

## Context and Problem Statement

閲覧者は `Viewer = { kind: "anonymous" } | AdminViewer` で表し、使う側は `viewer.kind === "admin"` で分けている (`shared/auth/get-current-admin.ts`、`app/layout/sidebar.tsx`)。

- `{ kind: "admin", user, loginPath }` はただのオブジェクトリテラルで、どこでも書ける。中の `user` は `AdminUser` (ブランド型) だが、外側の `kind` は誰も保証していない
- `kind` は「誰か」を問う。specs/016 は範囲の判定を「管理者か」ではなく「全期間を見られるか」で考えると決めていて、`kind === "admin"` が増えるほど、権限を広げるときに直す箇所が散らばる
- WebMCP のツール (adr/frontend/0014) を閲覧者で出し分けるにあたり、出し分けの根拠を型で示したい

## Decision

**閲覧者の権限は、照合したときにだけ `parse` で作るブランド型の値で表し、値があることを権限の証明にする。** `kind` は廃止する。

```ts
export type AdminViewer = z.infer<typeof adminViewer>; // { user: AdminUser; loginPath?: string } & brand
export interface Viewer {
  admin?: AdminViewer;
}
```

- `AdminViewer` は、セッションの応答と `loginPath` を 1 回の `parse` で作る。`user` を `AdminUser` として parse した後で、もう一度検証し直さない
- 使う側は `viewer.admin` があるかどうかで分ける。文字列の比較は書かない
- 権限を受け取る関数は、必要な分だけを引数に取る。秘匿パス (`loginPath`) が要らないなら `AdminViewer` ではなく `AdminUser` を渡す (adr/frontend/0014 の WebMCP のツール)
- specs/016 の「全期間を見られる」は、実装するときに権限ごとのブランド型 (例: `fullTimeline?: FullTimelineAccess`) として `Viewer` に足す。今は作らない

## Consequences

- Good, because 管理者の値は照合の `parse` からしか作れず、quality.md の `as` の禁止と合わせて偽れなくなる
- Good, because 権限を広げるとき (登録ユーザー・有料) は `Viewer` にブランド型を足すだけで、使う側の判定は値の有無のまま変わらない
- Good, because 秘匿パスを持つ値と持たない値を型で分けられ、渡す先で漏れない
- Bad, because `kind` で分ける判別共用体の書き方 (`switch (viewer.kind)`) は使えない。今は 2 か所なので問題にならない

## Implementation Plan

- **Affected paths**: `frontend/src/shared/auth/{get-current-admin,session.server,index}.ts`、`frontend/src/app/layout/sidebar.tsx`
- **Pattern**:
  - `adminViewer` のスキーマは、`adminUser` と `session` のスキーマがある `session.server.ts` に置き、`session` を `extend` して作る。セッションの応答を `currentAdmin` (`AdminUser` を返す) と `currentAdminViewer` (`AdminViewer` を返す) のそれぞれが 1 回だけ parse する。`getCurrentAdmin` は `currentAdminViewer` を呼ぶだけにする
  - `getCurrentAdmin` は `{ admin: AdminViewer | undefined }` を返す。秘匿パスをログイン中の応答にだけ載せる (FR-014) 点は変えない
  - `ChannelNav` は `viewer.admin && <AdminTabs admin={viewer.admin} />` にする
- **Patterns to avoid**:
  - `kind` を残したまま足す (判定が 2 通りになる)
  - `AdminViewer` を `as` やオブジェクトリテラルで作る (stories・テストを含む)
- **Tests**: 1 件。オブジェクトリテラルが `AdminViewer` に代入できないことを `@ts-expect-error` で確かめる (typescript-app.md「異なるブランド間の代入エラーを確認する」)

### Verification

- [x] `grep -rn 'kind: "admin"\|kind === "admin"\|kind: "anonymous"' frontend/src` が空 (2026-11-12)
- [x] `just lint && just test`、`just fe-typecheck` (2026-11-12)
- [x] `just fe-test-e2e admin-login` (セッションの値の受け渡しに触れるため) (2026-11-12)

## Revisit

specs/016 を実装するときに、「全期間を見られる」権限のブランド型を足す。`Viewer` の権限が 3 つ以上になり、組み合わせに意味が出てきたら、判別共用体に戻すかを考え直す。
