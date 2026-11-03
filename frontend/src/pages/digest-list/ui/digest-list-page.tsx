import { getRouteApi } from "@tanstack/react-router";
import { useId, useState } from "react";
import { Chevron } from "#/shared/ui/chevron";
import { RouterLink } from "#/shared/ui/router-link";
import { groupByMonth } from "../model/group-by-month";
import type { DigestStatus } from "#/shared/api";
import type { YearGroup } from "../model/group-by-month";
import styles from "./digest-list-page.module.css";

const route = getRouteApi("/_shell/admin/digests/");

// entryDate は UTC の 0 時として読まれるため、UTC で書式化しないと前日になりうる
const dayFormat = new Intl.DateTimeFormat("ja-JP", {
  day: "numeric",
  weekday: "short",
  timeZone: "UTC",
});

// ほとんどが公開なので、印は公開以外にだけ付ける (specs/006 research R6)
const statusMark: Record<DigestStatus, string | undefined> = {
  draft: "下書き",
  published: undefined,
  private: "非公開",
};

const Year = ({ group, defaultOpen }: { group: YearGroup; defaultOpen: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  return (
    <section>
      <h2 className={styles.yearHeading}>
        <button
          aria-controls={panelId}
          aria-expanded={open}
          className={styles.year}
          type="button"
          onClick={() => {
            setOpen((o) => !o);
          }}
        >
          {group.year} 年
          <Chevron className={styles.chevron} size={18} />
        </button>
      </h2>
      <div className={styles.panel} id={panelId}>
        <div className={styles.panelInner}>
          {group.months.map((m) => (
            <section key={m.month} className={styles.month}>
              <h3 className={styles.monthHeading}>
                {m.month}月<span className={styles.count}>{m.items.length} 件</span>
              </h3>
              <ul className={styles.days}>
                {m.items.map((d) => (
                  <li key={d.id}>
                    <RouterLink
                      className={styles.day}
                      params={{ date: d.entryDate }}
                      to="/admin/digests/$date/edit"
                    >
                      {dayFormat.format(new Date(d.entryDate))}
                      {statusMark[d.status] !== undefined && (
                        <span className={styles.status}>{statusMark[d.status]}</span>
                      )}
                    </RouterLink>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
};

export const DigestListPage = () => {
  const { digests } = route.useLoaderData();
  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>記事を編集</h1>
      {digests.length === 0 ? (
        <p className={styles.empty}>まだ Digest がないです</p>
      ) : (
        <div className={styles.years}>
          {groupByMonth(digests).map((y, i) => (
            <Year key={y.year} defaultOpen={i === 0} group={y} />
          ))}
        </div>
      )}
    </div>
  );
};
