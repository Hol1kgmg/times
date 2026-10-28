ALTER TABLE articles DROP CONSTRAINT articles_created_by_url_key;
ALTER TABLE articles ADD CONSTRAINT articles_digest_id_url_key UNIQUE (digest_id, url);
ALTER TABLE articles DROP COLUMN created_by;
ALTER TABLE digests DROP COLUMN created_by;
