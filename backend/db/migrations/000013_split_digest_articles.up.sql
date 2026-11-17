-- 記事と掲載を分け、再掲載を同じ記事の 2 つ目の掲載として表す (adr/backend/0008)
CREATE TABLE digest_articles (
    digest_id uuid NOT NULL REFERENCES digests (id) ON DELETE CASCADE,
    article_id uuid NOT NULL REFERENCES articles (id),
    parent_id uuid,
    position integer NOT NULL,
    is_hot boolean NOT NULL DEFAULT false,
    PRIMARY KEY (digest_id, article_id),
    UNIQUE (digest_id, position),
    FOREIGN KEY (digest_id, parent_id) REFERENCES digest_articles (digest_id, article_id) ON DELETE CASCADE,
    CHECK (parent_id <> article_id)
);
-- 孤立した記事の削除と、再掲載の判定は記事から掲載を引く
CREATE INDEX digest_articles_article_id_idx ON digest_articles (article_id);

INSERT INTO digest_articles (digest_id, article_id, parent_id, position, is_hot)
SELECT a.digest_id, a.id, l.parent_id, a.position, a.is_hot
FROM articles a LEFT JOIN article_links l ON l.child_id = a.id;

DROP TABLE article_links;
ALTER TABLE articles DROP COLUMN digest_id, DROP COLUMN position, DROP COLUMN is_hot;
