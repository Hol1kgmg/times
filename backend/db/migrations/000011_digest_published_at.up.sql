-- 既存の公開の Digest は公開時刻を持たないので埋めない。フィードに載せない (specs/010 FR-008)
ALTER TABLE digests ADD COLUMN published_at timestamptz;
ALTER TABLE digests ADD CONSTRAINT digests_draft_not_published CHECK (status <> 'draft' OR published_at IS NULL);
