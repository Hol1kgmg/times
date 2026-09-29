# Specification Quality Checklist: 管理者ログイン

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-26
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`
- 2026-09-26: ログイン方式を GitHub 認証 (サービス内にパスワードを持たない) に確定。連続失敗制限はサービス側の責務から外した。全項目合格
- 2026-09-26: ログイン画面を環境設定の秘匿パスに置き、未ログインの保護ページは 404 にする方針を反映。許可の照合は GitHub ユーザー名 (改名時の運用上の注意を Assumptions に記載)。全項目合格
- 2026-09-26: 許可ユーザー名はログイン入口の判定にだけ使い、ログイン後の本人識別と将来の記録は GitHub の固定 ID にする (FR-011, FR-013, SC-009)。作業中の期限切れはモーダルで再ログインを案内する (FR-014)。SC の採番を整理
- 2026-09-26: GitHub からの戻り先 URL は正当な流れ以外 404 (FR-006, SC-005, Edge Cases)。Cookie 拒否時の表示は削り、遷移後に 404 になるだけに留めた
- 2026-09-26: 秘匿パスはログイン成立後の画面のサーバー描画でだけ渡す (FR-014, Edge Cases)。期限切れの拒否は画面が判別できる応答にする (FR-014)。FR-006 の表示禁止を秘匿パス以外の要求に限定。FR-010 は記事登録画面の URL へ移動に統一。検証用秘密情報の更新で全ログイン状態が無効になること、個別失効を持たないことを Assumptions に追記。記事登録画面の URL 露出は 001 未実装のため扱わない
- 2026-09-26: backend 起点に改訂 (adr/backend/0007)。ログイン状態は backend の記録とし、個別失効を持つ (FR-019、上の「個別失効を持たない」を置き換え)
- 2026-09-26: 範囲をログイン機能と「管理者専用」を守る仕組みに限定。記事登録画面などの具体的なページは作らない (FR-001)。ログイン後はトップページへ (FR-018)。ログイン中表示とログアウトは秘匿パスのページに置く (FR-008 〜 FR-010)。FR-014 のモーダルは後続のページの仕様に委ね、判別できる拒否応答だけを残す。全項目合格
