import { getRouteApi } from "@tanstack/react-router";
import styles from "./health-page.module.css";

const route = getRouteApi("/health");

export const HealthPage = () => {
  const { status } = route.useLoaderData();
  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Backend health</h1>
      <p className={styles.status}>
        <span aria-hidden="true" className={styles.dot} />
        status: {status}
      </p>
    </div>
  );
};
