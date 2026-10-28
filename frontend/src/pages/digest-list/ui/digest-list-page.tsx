import { getRouteApi, Link } from "@tanstack/react-router";
import { dateFormat } from "#/shared/ui/digest-post";
import styles from "./digest-list-page.module.css";

const route = getRouteApi("/_shell/admin/digests/");

export const DigestListPage = () => {
  const { items } = route.useLoaderData();
  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>記事を編集</h1>
      {items.length === 0 ? (
        <p className={styles.empty}>まだ Digest がないです</p>
      ) : (
        <ul className={styles.list}>
          {items.map((d) => (
            <li key={d.id}>
              <Link
                className={styles.link}
                params={{ date: d.entryDate }}
                to="/admin/digests/$date/edit"
              >
                {dateFormat.format(new Date(d.entryDate))}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
