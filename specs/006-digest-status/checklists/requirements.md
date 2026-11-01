# Specification Quality Checklist: Digest の公開ステータス

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-10-31
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

- API の形は会話で合意済み。spec では振る舞いだけを書き、形は plan で扱う (b68061d / f560cbd 以降の名前で記す)
  - `createDigest`: `NewDigest` に任意の `status` (`draft` / `published`、省略時 `draft`)
  - `updateDigest`: 今は `NewDigest` を使い回しているので、`entryDate` と `articles` は同じまま更新用スキーマに分け、任意の `status` (`published` / `private`、省略時は今のまま)
  - `Digest` と `DigestSummary` (`DigestList.digests` の要素) に必須の `status` (`draft` / `published` / `private`)
- `listDigests` と `getDigestByDate` は管理者専用 (bearerAuth) にする。未ログインに見せるのは `getLatestDigest` の公開 1 件だけ (specs/005 FR-004 を置き換え)
