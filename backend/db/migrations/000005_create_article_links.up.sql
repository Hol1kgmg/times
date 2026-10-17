-- 親子は列ではなく別テーブルで持つ。将来 digest をまたぐ関連や多対多に広げても articles を触らないため
CREATE TABLE article_links (
    parent_id uuid NOT NULL REFERENCES articles (id) ON DELETE CASCADE,
    child_id uuid NOT NULL REFERENCES articles (id) ON DELETE CASCADE,
    position integer NOT NULL,
    PRIMARY KEY (child_id),
    UNIQUE (parent_id, position),
    CHECK (parent_id <> child_id)
);
