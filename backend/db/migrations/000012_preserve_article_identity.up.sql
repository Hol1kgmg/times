-- 既存の行は最初に載せた時刻が分からないので、所属する Digest を登録した時刻で埋める (issue #114)
ALTER TABLE articles ADD COLUMN created_at timestamptz;
UPDATE articles a SET created_at = d.created_at FROM digests d WHERE d.id = a.digest_id;
ALTER TABLE articles ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE articles ALTER COLUMN created_at SET DEFAULT now();
-- 記事を行ごとに更新すると、並べ替えで位置を入れ替える途中に即時の検査で 23505 になる
ALTER TABLE articles DROP CONSTRAINT articles_digest_id_position_key;
ALTER TABLE articles ADD CONSTRAINT articles_digest_id_position_key UNIQUE (digest_id, position) DEFERRABLE INITIALLY DEFERRED;
