-- url は href にそのまま出るので http(s) 以外を DB でも弾く (openapi.yaml の NewArticle.url pattern と同じ)
ALTER TABLE articles ADD CONSTRAINT articles_url_scheme_check CHECK (url ~ '^https?://');
