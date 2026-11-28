-- HOT の親の下では子の HOT を切り替えられなかったので、この子の HOT はすべて親から写した値 (issue #265)
UPDATE digest_articles c SET is_hot = false
FROM articles a, digest_articles p
WHERE c.article_id = a.id AND p.article_id = a.parent_id AND p.digest_id = c.digest_id AND p.is_hot AND c.is_hot;
