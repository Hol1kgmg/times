import styles from "./ai-sorting-status.module.css";

// 出し入れすると live region ごと消えて読み上げが届かず、横の部品も動くので、場所は常に取っておく
export const AiSortingStatus = ({ active }: { active: boolean }) => (
  <output className={styles.status} data-active={active ? "" : undefined}>
    <span aria-hidden="true" className={styles.spinner} />
    AIカテゴリ分類中
  </output>
);
