-- 記事と掲載を分け、再掲載を同じ記事の 2 つ目の掲載として表す。親子は記事どうしの関係 (adr/backend/0008)
CREATE TABLE digest_articles (
    digest_id uuid NOT NULL REFERENCES digests (id) ON DELETE CASCADE,
    article_id uuid NOT NULL REFERENCES articles (id),
    position integer NOT NULL,
    is_hot boolean NOT NULL DEFAULT false,
    PRIMARY KEY (digest_id, article_id),
    UNIQUE (digest_id, position)
);
-- 孤立した記事の削除と、元の掲載・初掲載の日付を導くとき、記事から掲載を引く
CREATE INDEX digest_articles_article_id_idx ON digest_articles (article_id);

INSERT INTO digest_articles (digest_id, article_id, position, is_hot)
SELECT digest_id, id, position, is_hot FROM articles;

ALTER TABLE articles
    ADD COLUMN parent_id uuid,
    ADD COLUMN is_child boolean GENERATED ALWAYS AS (parent_id IS NOT NULL) STORED,
    ADD COLUMN parent_is_child boolean NOT NULL DEFAULT false CONSTRAINT articles_parent_is_child_check CHECK (NOT parent_is_child),
    -- 子がほかの日にいて消せない親を、外す代わりに隠す
    ADD COLUMN hidden boolean NOT NULL DEFAULT false;
ALTER TABLE articles
    ADD CONSTRAINT articles_id_is_child_key UNIQUE (id, is_child),
    ADD CONSTRAINT articles_parent_id_check CHECK (parent_id <> id),
    -- 親に指せるのは子でない記事だけ。子を持つ記事に親を付けると、子からの FK が止める
    ADD CONSTRAINT articles_parent_id_parent_is_child_fkey FOREIGN KEY (parent_id, parent_is_child) REFERENCES articles (id, is_child);

UPDATE articles a SET parent_id = l.parent_id FROM article_links l WHERE l.child_id = a.id;

DROP TABLE article_links;
ALTER TABLE articles DROP COLUMN digest_id, DROP COLUMN position, DROP COLUMN is_hot;
