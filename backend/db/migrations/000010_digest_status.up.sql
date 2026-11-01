-- 既存の Digest は公開のまま残す。既定値は openapi.yaml にだけ置き、DB と食い違わせない (specs/006 research R1)
ALTER TABLE digests ADD COLUMN status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'private'));
ALTER TABLE digests ALTER COLUMN status DROP DEFAULT;
