-- 開発用ダミーデータ。`just db-seed` で投入する。
-- id を固定して ON CONFLICT DO NOTHING にしてあるので、何度流しても増えない。
-- 2 日分入れてあり、GET /digests/latest は 2026-09-22 の方を返す。

INSERT INTO digests (id, entry_date) VALUES
    ('00000000-0000-4000-8000-000000000001', '2026-09-21'),
    ('00000000-0000-4000-8000-000000000002', '2026-09-22')
ON CONFLICT (id) DO NOTHING;

INSERT INTO articles (id, digest_id, position, category, title, url, description) VALUES
    -- 2026-09-21
    ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 1, 'IT系',   'Go 1.26 リリースノート', 'https://go.dev/doc/go1.26', 'Go 1.26 の変更点まとめ'),
    ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 2, 'その他', '手書きの sample.json を卒業する', 'https://example.com/2026/09/21/sample-json', NULL),
    -- 2026-09-22 (最新)
    ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000002', 1, 'セキュリティ',   'CVE-2026-XXXX: よくあるライブラリの脆弱性', 'https://example.com/security/cve-2026-xxxx', '影響範囲と対応バージョン'),
    ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000002', 2, 'ホットトピック', 'Postgres 18 の新機能', 'https://www.postgresql.org/docs/18/release-18.html', NULL),
    ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000002', 3, 'IT系',   'sqlc と oapi-codegen で契約ファースト', 'https://example.com/it/contract-first', 'OpenAPI と SQL から型を生成する構成'),
    ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000002', 4, 'IT系',   'TanStack Start のサーバー関数入門', 'https://tanstack.com/start/latest', NULL),
    ('00000000-0000-4000-8000-000000000205', '00000000-0000-4000-8000-000000000002', 5, 'UI系',   '白背景と 1px 境界線で作る UI', 'https://example.com/ui/border-first', 'グラデーションを使わない設計'),
    ('00000000-0000-4000-8000-000000000206', '00000000-0000-4000-8000-000000000002', 6, 'AI系',   'Claude Code でスペック駆動開発', 'https://example.com/ai/spec-driven', NULL),
    ('00000000-0000-4000-8000-000000000207', '00000000-0000-4000-8000-000000000002', 7, '面白そうなツール・サービス', 'just: コマンドランナー', 'https://github.com/casey/just', 'Makefile の代替'),
    ('00000000-0000-4000-8000-000000000208', '00000000-0000-4000-8000-000000000002', 8, 'その他', 'Understanding React 19''s new hooks', 'https://example.com/react-19-hooks', 'This is a long description that should be truncated by the digest view because it goes on and on without saying anything new about the new hooks in React 19.')
ON CONFLICT (id) DO NOTHING;
