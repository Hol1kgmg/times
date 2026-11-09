ALTER TABLE articles DROP CONSTRAINT articles_digest_id_position_key;
ALTER TABLE articles ADD CONSTRAINT articles_digest_id_position_key UNIQUE (digest_id, position);
ALTER TABLE articles DROP COLUMN created_at;
