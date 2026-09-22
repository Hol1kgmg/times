import { Link, Outlet } from "@tanstack/react-router";
import styles from "./root-layout.module.css";

// アプリ全体のレイアウト (nav + main)。ページ固有の要素は置かない
export const RootLayout = () => (
  <div className={styles.layout}>
    <nav>
      <Link to="/">Home</Link> |{" "}
      <Link params={{ id: "1" }} to="/items/$id">
        Item 1
      </Link>{" "}
      | <Link to="/client">Client only</Link>
    </nav>
    <main className={styles.main}>
      <Outlet />
    </main>
  </div>
);
