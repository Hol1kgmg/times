-- 新規作成は 1 日 1 digest。その日への追記は今後の更新処理で扱い、作成からは受けない
ALTER TABLE digests ADD CONSTRAINT digests_created_by_entry_date_key UNIQUE (created_by, entry_date);
