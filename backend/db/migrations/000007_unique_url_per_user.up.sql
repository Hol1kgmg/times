-- 気になった記事をまとめるアプリなので、一度載せた URL を別の日に載せ直す意味はない。同じ人は同じ URL を全期間で 1 回だけ
-- 同じ日付の再登録は前の digest を消して入れ直す運用に変わるので、既存の古い方 (表示されない行) も消しておく
DELETE FROM digests d WHERE EXISTS (SELECT 1 FROM digests n WHERE n.entry_date = d.entry_date AND n.created_at > d.created_at);
ALTER TABLE digests ADD COLUMN created_by bigint REFERENCES users (id);
-- unique を張るために articles にも持つ (digest から引けるが制約は 1 テーブルにしか張れない)
ALTER TABLE articles ADD COLUMN created_by bigint REFERENCES users (id);
-- ponytail: 管理者 1 人の前提で既存行をその人に寄せる。users が空 (seed だけの開発 DB) なら NOT NULL で落ちるので db-reset する
UPDATE digests SET created_by = (SELECT id FROM users ORDER BY created_at LIMIT 1);
UPDATE articles a SET created_by = d.created_by FROM digests d WHERE d.id = a.digest_id;
ALTER TABLE digests ALTER COLUMN created_by SET NOT NULL;
ALTER TABLE articles ALTER COLUMN created_by SET NOT NULL;
ALTER TABLE articles DROP CONSTRAINT articles_digest_id_url_key;
ALTER TABLE articles ADD CONSTRAINT articles_created_by_url_key UNIQUE (created_by, url);
