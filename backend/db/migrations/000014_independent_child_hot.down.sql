UPDATE digest_articles c SET is_hot = true
FROM articles a, digest_articles p
WHERE c.article_id = a.id AND p.article_id = a.parent_id AND p.digest_id = c.digest_id AND p.is_hot AND NOT c.is_hot;
