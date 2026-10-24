ALTER TABLE articles DROP CONSTRAINT articles_category_check;
UPDATE articles SET category = 'ホットトピック' WHERE is_hot;
ALTER TABLE articles ADD CONSTRAINT articles_category_check CHECK (category IN ('セキュリティ', 'ホットトピック', 'IT系', 'UI系', 'AI系', '面白そうなツール・サービス', 'その他'));
ALTER TABLE articles DROP COLUMN is_hot;
