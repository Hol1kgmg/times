-- 子の行も category と同じく親の is_hot を持つ。down で旧仕様 (子は親のカテゴリ) にそのまま戻すため (specs/004 research R2)
ALTER TABLE articles ADD COLUMN is_hot boolean NOT NULL DEFAULT false;
ALTER TABLE articles DROP CONSTRAINT articles_category_check;
-- 本来のカテゴリはデータから導けないので「その他」に寄せ、同じ日付の再登録で正す (specs/004 FR-009)
UPDATE articles SET is_hot = true, category = 'その他' WHERE category = 'ホットトピック';
ALTER TABLE articles ADD CONSTRAINT articles_category_check CHECK (category IN ('セキュリティ', 'IT系', 'UI系', 'AI系', '面白そうなツール・サービス', 'その他'));
