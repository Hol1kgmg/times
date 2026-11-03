ALTER TABLE digests DROP CONSTRAINT digests_draft_not_published;
ALTER TABLE digests DROP COLUMN published_at;
