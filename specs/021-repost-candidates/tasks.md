# タスク

- [x] T001 `backend/api/openapi.yaml` に `listRepostCandidates` と `RepostCandidateList` を足し、`q` を `ArticleSearchQuery` に切り出す
- [x] T002 `backend/db/queries/articles.sql` に `ListRepostCandidates` を足し、`just be-gen`
- [x] T003 `backend/internal/handler/handler.go` に `ListRepostCandidates` を足す
- [x] T004 `backend/cmd/server/main_test.go` に 401 と 400 のテストを足す
- [x] T005 `frontend/src/shared/api/schemas.ts` にスキーマ、`repost-candidates.ts` にサーバー関数を足す
- [x] T006 `just lint && just test && just fe-typecheck`、`just fe-test-e2e article-search` で回帰を確かめる
