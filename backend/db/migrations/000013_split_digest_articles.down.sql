-- 記事 1 つにつき掲載 1 つの形に戻すので、各記事のいちばん古い掲載だけを残し、再掲載は捨てる
ALTER TABLE articles
    ADD COLUMN digest_id uuid REFERENCES digests (id) ON DELETE CASCADE,
    ADD COLUMN position integer,
    ADD COLUMN is_hot boolean NOT NULL DEFAULT false;

CREATE TEMP TABLE first_placements AS
SELECT DISTINCT ON (da.article_id) da.*
FROM digest_articles da JOIN digests d ON d.id = da.digest_id
ORDER BY da.article_id, d.entry_date, d.created_at;

UPDATE articles a SET digest_id = f.digest_id, position = f.position, is_hot = f.is_hot
FROM first_placements f WHERE f.article_id = a.id;
DELETE FROM articles WHERE digest_id IS NULL;
ALTER TABLE articles ALTER COLUMN digest_id SET NOT NULL, ALTER COLUMN position SET NOT NULL;
ALTER TABLE articles ADD CONSTRAINT articles_digest_id_position_key UNIQUE (digest_id, position) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE article_links (
    parent_id uuid NOT NULL REFERENCES articles (id) ON DELETE CASCADE,
    child_id uuid NOT NULL REFERENCES articles (id) ON DELETE CASCADE,
    position integer NOT NULL,
    PRIMARY KEY (child_id),
    UNIQUE (parent_id, position),
    CHECK (parent_id <> child_id)
);
-- 親が別の日に戻った子 (再掲載の子) は、親を失うのでその日の親として残す
INSERT INTO article_links (parent_id, child_id, position)
SELECT c.parent_id, c.article_id, row_number() OVER (PARTITION BY c.parent_id ORDER BY c.position) - 1
FROM first_placements c JOIN first_placements p ON p.article_id = c.parent_id AND p.digest_id = c.digest_id
WHERE c.parent_id IS NOT NULL;

DROP TABLE first_placements;
DROP TABLE digest_articles;
