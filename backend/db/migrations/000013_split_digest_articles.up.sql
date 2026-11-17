-- 記事と掲載を分け、再掲載を同じ記事の 2 つ目の掲載として表す (adr/backend/0008)
CREATE TABLE digest_articles (
    digest_id uuid NOT NULL REFERENCES digests (id) ON DELETE CASCADE,
    article_id uuid NOT NULL REFERENCES articles (id),
    parent_id uuid,
    position integer NOT NULL,
    is_hot boolean NOT NULL DEFAULT false,
    -- 元の記事を参照する再掲載。記事のタイトル・カテゴリを書き換えない (specs/018 FR-004)
    is_repost boolean NOT NULL DEFAULT false,
    PRIMARY KEY (digest_id, article_id),
    UNIQUE (digest_id, position),
    FOREIGN KEY (digest_id, parent_id) REFERENCES digest_articles (digest_id, article_id) ON DELETE CASCADE,
    CHECK (parent_id <> article_id),
    CHECK (NOT is_repost OR (parent_id IS NULL AND NOT is_hot))
);
-- 登録済みの URL を普通の親として通す抜けを DB でも止める
CREATE UNIQUE INDEX digest_articles_original_key ON digest_articles (article_id) WHERE NOT is_repost;
-- 孤立した記事の削除と、再掲載の判定は記事から掲載を引く
CREATE INDEX digest_articles_article_id_idx ON digest_articles (article_id);

INSERT INTO digest_articles (digest_id, article_id, parent_id, position, is_hot)
SELECT a.digest_id, a.id, l.parent_id, a.position, a.is_hot
FROM articles a LEFT JOIN article_links l ON l.child_id = a.id;

DROP TABLE article_links;
ALTER TABLE articles DROP COLUMN digest_id, DROP COLUMN position, DROP COLUMN is_hot;
