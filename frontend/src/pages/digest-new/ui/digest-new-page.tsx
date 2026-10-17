import { useServerFn } from "@tanstack/react-start";
import { useState, useSyncExternalStore } from "react";
// barrel (#/shared/api) は .server.ts を再 export しており、クライアントで走るコードから import すると build が落ちる
import { category } from "#/shared/api/schemas";
import type { Category } from "#/shared/api/schemas";
import { createDigest } from "../api/create-digest";
import styles from "./digest-new-page.module.css";

interface ChildRow {
  key: number;
  url: string;
  title: string;
}

interface Row extends ChildRow {
  category: Category;
  children: ChildRow[];
}

// toISOString は UTC 日付になり JST の 0〜9 時に前日を返す。sv-SE ロケールはローカル日付を YYYY-MM-DD で出す
const today = () => new Date().toLocaleDateString("sv-SE");
// 購読元はないので解除も何もしない
const noop = () => {
  /* 何もしない */
};
const subscribeNever = () => noop;
const emptyChild = (key: number): ChildRow => ({ key, url: "", title: "" });
const emptyRow = (key: number): Row => ({ ...emptyChild(key), category: "その他", children: [] });

export const DigestNewPage = () => {
  const submit = useServerFn(createDigest);
  // SSR のサーバー TZ とブラウザの日付がずれると hydration 不一致になるので、既定値はクライアントでだけ決める
  const defaultDate = useSyncExternalStore(subscribeNever, today, () => "");
  const [editedDate, setEditedDate] = useState<string>();
  const entryDate = editedDate ?? defaultDate;
  const [rows, setRows] = useState<Row[]>([emptyRow(0)]);
  const [nextKey, setNextKey] = useState(1);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const update = (key: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };
  const addRow = () => {
    setRows((prev) => [...prev, emptyRow(nextKey)]);
    setNextKey(nextKey + 1);
  };
  const removeRow = (key: number) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
  };
  const updateChild = (rowKey: number, key: number, patch: Partial<ChildRow>) => {
    setRows((prev) =>
      prev.map((r) =>
        r.key === rowKey
          ? { ...r, children: r.children.map((c) => (c.key === key ? { ...c, ...patch } : c)) }
          : r,
      ),
    );
  };
  const addChild = (rowKey: number) => {
    setRows((prev) =>
      prev.map((r) =>
        r.key === rowKey ? { ...r, children: [...r.children, emptyChild(nextKey)] } : r,
      ),
    );
    setNextKey(nextKey + 1);
  };
  const removeChild = (rowKey: number, key: number) => {
    setRows((prev) =>
      prev.map((r) =>
        r.key === rowKey ? { ...r, children: r.children.filter((c) => c.key !== key) } : r,
      ),
    );
  };
  const onSubmit = async () => {
    setBusy(true);
    setFailed(false);
    try {
      // navigate は呼ばない。成功時はサーバー関数が redirect を投げ、Router が / へ遷移する
      await submit({
        data: {
          entryDate,
          items: rows.map(({ url, title, category: c, children }) => ({
            url,
            title,
            category: c,
            children: children.map((ch) => ({ url: ch.url, title: ch.title })),
          })),
        },
      });
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>記事を登録</h1>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit();
        }}
      >
        <label className={styles.field}>
          <span className={styles.label}>日付</span>
          <input
            className={styles.input}
            required
            type="date"
            value={entryDate}
            onChange={(e) => {
              setEditedDate(e.target.value);
            }}
          />
        </label>
        <ul className={styles.rows}>
          {rows.map((row, i) => (
            <li key={row.key} className={styles.card}>
              <div className={styles.row}>
                <label className={styles.field}>
                  <span className={styles.label}>URL</span>
                  <input
                    className={styles.input}
                    maxLength={2000}
                    name={`url-${i}`}
                    required
                    type="url"
                    value={row.url}
                    onChange={(e) => {
                      update(row.key, { url: e.target.value });
                    }}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>タイトル</span>
                  <input
                    className={styles.input}
                    maxLength={300}
                    name={`title-${i}`}
                    required
                    type="text"
                    value={row.title}
                    onChange={(e) => {
                      update(row.key, { title: e.target.value });
                    }}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>分類</span>
                  <select
                    className={styles.input}
                    name={`category-${i}`}
                    value={row.category}
                    onChange={(e) => {
                      update(row.key, { category: category.parse(e.target.value) });
                    }}
                  >
                    {category.options.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className={styles.secondary}
                  disabled={rows.length === 1}
                  type="button"
                  onClick={() => {
                    removeRow(row.key);
                  }}
                >
                  削除
                </button>
              </div>
              {row.children.length > 0 && (
                <ul className={styles.children}>
                  {row.children.map((child, j) => (
                    <li key={child.key} className={styles.row}>
                      <label className={styles.field}>
                        <span className={styles.label}>関連 URL</span>
                        <input
                          className={styles.input}
                          maxLength={2000}
                          name={`url-${i}-${j}`}
                          required
                          type="url"
                          value={child.url}
                          onChange={(e) => {
                            updateChild(row.key, child.key, { url: e.target.value });
                          }}
                        />
                      </label>
                      <label className={styles.field}>
                        <span className={styles.label}>関連タイトル</span>
                        <input
                          className={styles.input}
                          maxLength={300}
                          name={`title-${i}-${j}`}
                          required
                          type="text"
                          value={child.title}
                          onChange={(e) => {
                            updateChild(row.key, child.key, { title: e.target.value });
                          }}
                        />
                      </label>
                      <button
                        className={styles.secondary}
                        type="button"
                        onClick={() => {
                          removeChild(row.key, child.key);
                        }}
                      >
                        削除
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                className={styles.secondary}
                disabled={row.children.length >= 20}
                name={`add-child-${i}`}
                type="button"
                onClick={() => {
                  addChild(row.key);
                }}
              >
                関連記事を追加
              </button>
            </li>
          ))}
        </ul>
        <div className={styles.actions}>
          <button
            className={styles.secondary}
            disabled={rows.length >= 100}
            type="button"
            onClick={addRow}
          >
            行を追加
          </button>
          <button className={styles.button} disabled={busy} type="submit">
            登録
          </button>
        </div>
        {failed && (
          <p className={styles.message}>
            登録に失敗しました。同じ URL が重複していないか確認してください
          </p>
        )}
      </form>
    </div>
  );
};
