import { getRouteApi, Link } from "@tanstack/react-router";
import styles from "./home-page.module.css";

// getRouteApi でルート定義 (app 層) を import せずに loader/search の型を得る
const route = getRouteApi("/");

export const HomePage = () => {
  const items = route.useLoaderData();
  const { q } = route.useSearch();
  const navigate = route.useNavigate();
  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Items</h1>
      <input
        className={styles.filter}
        placeholder="filter"
        value={q}
        onChange={(e) => {
          void navigate({ search: { q: e.target.value }, replace: true });
        }}
      />
      <ul className={styles.list}>
        {items.map((i) => (
          <li key={i.id} className={styles.card}>
            <Link className={styles.cardLink} params={{ id: i.id }} to="/items/$id">
              {i.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};
