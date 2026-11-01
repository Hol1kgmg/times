import {
  addTransitionType,
  startTransition,
  useEffect,
  useRef,
  useState,
  ViewTransition,
} from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { flushSync } from "react-dom";
import { Temporal } from "temporal-polyfill/implementation";
import { Chevron } from "#/shared/ui/chevron";
import { HoverButton } from "#/shared/ui/hover-button";
import { monthDays, stepEnabled } from "#/shared/lib/month-days";
import styles from "./date-picker.module.css";
import { useModal } from "./modal";

export interface DisabledDates {
  dates: ReadonlySet<string>;
  // 読み上げで選べない理由として日付の後ろに付ける
  label: string;
}

const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

const keySteps: Partial<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

type View = "year" | "month";

interface CalendarProps {
  ym: Temporal.PlainYearMonth;
  value: string;
  disabled: DisabledDates;
  named: boolean;
  onPick?: (date: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLButtonElement>) => void;
}

// 箱ごと撮ると年表示と月表示で縦横比が違い、字が歪んで二重に見える。字だけを包んで年表示と月表示で同じ名前を付ける
const Morph = ({ name, children }: { name: string | undefined; children: ReactNode }) => (
  <span
    className={styles.morph}
    style={
      name === undefined
        ? undefined
        : { viewTransitionName: name, viewTransitionClass: styles.morph }
    }
  >
    {children}
  </span>
);

const Calendar = ({ ym, value, disabled, named, onPick, onKeyDown }: CalendarProps) => {
  const { lead, days } = monthDays(ym.year, ym.month);
  const interactive = onPick !== undefined;
  const cell = interactive ? styles.cellLarge : styles.cell;
  const today = Temporal.Now.plainDateISO().toString();
  return (
    <div className={styles.calendar}>
      {days.map((day, i) => {
        const date = day.toString();
        const className = `${cell} ${disabled.dates.has(date) ? styles.disabled : ""} ${date === value ? styles.selected : ""}`;
        const style = i === 0 ? { gridColumnStart: lead + 1 } : undefined;
        const digits = <Morph name={named ? `day-${date}` : undefined}>{day.day}</Morph>;
        return interactive ? (
          <HoverButton
            key={date}
            aria-current={date === today ? "date" : undefined}
            aria-label={`${day.toLocaleString("ja-JP", { month: "long", day: "numeric", weekday: "short" })}${disabled.dates.has(date) ? ` ${disabled.label}` : ""}`}
            aria-pressed={date === value}
            className={className}
            data-date={date}
            disabled={disabled.dates.has(date)}
            style={style}
            type="button"
            onClick={() => {
              onPick(date);
            }}
            onKeyDown={onKeyDown}
          >
            {digits}
          </HoverButton>
        ) : (
          <span key={date} aria-hidden className={className} style={style}>
            {digits}
          </span>
        );
      })}
    </div>
  );
};

interface ViewProps {
  ym: Temporal.PlainYearMonth;
  value: string;
  disabled: DisabledDates;
  morph: boolean;
  onShare: () => void;
}

const slide = { next: styles.slideNext, prev: styles.slidePrev, default: "none" };

const weekdaysAt = "[data-weekdays]";
const cardAt = (m: Temporal.PlainYearMonth) => `[data-month="${m.toString()}"]`;

const MonthView = ({
  ym,
  value,
  disabled,
  morph,
  onShare,
  onPick,
  onKeyDown,
}: ViewProps & {
  onPick: (date: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
}) => (
  <div className={styles.monthView}>
    <div aria-hidden className={styles.weekdays} data-weekdays>
      {weekdays.map((w) => (
        <span key={w}>{w}</span>
      ))}
    </div>
    <div className={styles.panelSlot}>
      {/* 5 週の月でも 6 週分の高さを取る。dialog の高さが変わると、中央寄せでボタンが上下に動く */}
      <div aria-hidden className={`${styles.monthPanel} ${styles.ghost}`}>
        <div className={styles.calendar}>
          {Array.from({ length: 42 }, (_, i) => (
            <span key={i} className={styles.cellLarge} />
          ))}
        </div>
      </div>
      <ViewTransition
        default={styles.box}
        name={morph ? `month-${ym.toString()}` : "month-panel"}
        onShare={onShare}
      >
        <div className={`${styles.monthPanel} ${morph ? "" : styles.clip}`}>
          <ViewTransition key={ym.toString()} default="none" enter={slide} exit={slide}>
            <Calendar
              disabled={disabled}
              named={morph}
              value={value}
              ym={ym}
              onKeyDown={onKeyDown}
              onPick={onPick}
            />
          </ViewTransition>
        </div>
      </ViewTransition>
    </div>
  </div>
);

const YearView = ({
  ym,
  value,
  disabled,
  morph,
  onShare,
  onOpenMonth,
}: ViewProps & { onOpenMonth: (m: Temporal.PlainYearMonth) => void }) => (
  <ViewTransition key={ym.year} default="none" enter={slide} exit={slide}>
    <div className={styles.months}>
      {Array.from({ length: 12 }, (_, i) => ym.with({ month: i + 1 })).map((m) => (
        // 年送りでカードに名前があると 1 枚ずつ撮られ、グリッドごと滑らない
        <ViewTransition
          key={m.month}
          default={morph ? styles.box : "none"}
          name={`month-${m.toString()}`}
          onShare={onShare}
        >
          <section className={styles.month} data-month={m.toString()}>
            <h3 className={styles.monthHeading}>
              <HoverButton
                className={styles.monthLink}
                type="button"
                onClick={() => {
                  onOpenMonth(m);
                }}
              >
                <Morph name={morph && m.equals(ym) ? "period-month" : undefined}>{m.month}月</Morph>
              </HoverButton>
            </h3>
            {/* 全 12 か月の日付に名前を付けると 365 個を撮って数秒固まるので、動かす 1 か月にだけ付ける */}
            <Calendar disabled={disabled} named={morph && m.equals(ym)} value={value} ym={m} />
          </section>
        </ViewTransition>
      ))}
    </div>
  </ViewTransition>
);

export const DatePickerDialog = ({
  value,
  disabled,
  onPick,
  onClose,
}: {
  value: string;
  disabled: DisabledDates;
  onPick: (date: string) => void;
  onClose: () => void;
}) => {
  const { ref: dialogRef, dialogProps, close } = useModal(onClose);
  const thisMonth = Temporal.Now.plainDateISO().toPlainYearMonth();
  const [view, setView] = useState<View>("month");
  const [ym, setYm] = useState(() =>
    value === "" ? thisMonth : Temporal.PlainDate.from(value).toPlainYearMonth(),
  );
  const focusDate = (date: string) => {
    const button = dialogRef.current?.querySelector<HTMLButtonElement>(`[data-date="${date}"]`);
    button?.focus();
    return button !== null && button !== undefined;
  };
  const initialFocus = useRef(value === "" ? Temporal.Now.plainDateISO().toString() : value);
  // useModal の showModal より後に動くよう、effect はその後に宣言する
  useEffect(() => {
    const dialog = dialogRef.current;
    // showModal は先頭のボタン (年へ戻る) にフォーカスするので、選択中か今日の日付へ移す
    const enabled = "[data-date]:not(:disabled)";
    (
      dialog?.querySelector<HTMLButtonElement>(`${enabled}[data-date="${initialFocus.current}"]`) ??
      dialog?.querySelector<HTMLButtonElement>(enabled)
    )?.focus();
  }, [dialogRef]);
  // 月をまたぐ移動は transition の後に描かれるので、行き先が DOM に出たコミットでフォーカスする
  const pendingFocus = useRef<string>(undefined);
  useEffect(() => {
    if (pendingFocus.current !== undefined && focusDate(pendingFocus.current)) {
      pendingFocus.current = undefined;
    }
  });

  const [morph, setMorph] = useState(false);

  const center = (selector: string) => {
    const r = dialogRef.current?.querySelector(selector)?.getBoundingClientRect();
    return r && { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  };
  // 消える側は撮った後には DOM にないので、切り替え前に位置を取っておく
  const leaving = useRef<{ x: number; y: number }>(undefined);
  // 曜日は DOM の内側にあり React の enter/exit が起きないので、ボックスの share に合わせて動かす
  const gatherWeekdays = () => {
    const entering = center(weekdaysAt);
    const card = entering ? leaving.current : center(cardAt(ym));
    const week = entering ?? leaving.current;
    if (!card || !week || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const hidden = { opacity: 0, translate: `${card.x - week.x}px ${card.y - week.y}px` };
    const shown = { opacity: 1, translate: "0 0" };
    document.documentElement.animate(entering ? [hidden, shown] : [shown, hidden], {
      duration: 300,
      easing: "ease-out",
      fill: "both",
      pseudoElement: `::view-transition-${entering ? "new" : "old"}(date-picker-weekdays)`,
    });
  };

  // React の <ViewTransition> は transition の中の更新でだけ動く
  const go = (v: View, to: Temporal.PlainYearMonth) => {
    // 別の年の月へは数字の行き先が年表示の DOM にないので、送りとして滑らせる
    const switching = v !== view && to.year === ym.year;
    if (switching) {
      leaving.current = center(view === "month" ? weekdaysAt : cardAt(to));
    }
    // 撮る前に名前を付け替える。年と月の切り替えは数字を 1 つずつ動かし、月送りは日付の面ごと滑らせる
    flushSync(() => {
      setMorph(switching);
      if (switching) {
        setYm(to);
      }
    });
    startTransition(() => {
      addTransitionType("date-picker");
      if (!switching) {
        addTransitionType(Temporal.PlainYearMonth.compare(to, ym) > 0 ? "next" : "prev");
      }
      setView(v);
      setYm(to);
    });
  };
  const move = (e: KeyboardEvent<HTMLButtonElement>) => {
    const days = keySteps[e.key];
    const from = e.currentTarget.dataset.date;
    if (days === undefined || from === undefined) {
      return;
    }
    e.preventDefault();
    const to = stepEnabled(Temporal.PlainDate.from(from), days, disabled.dates);
    if (to.toPlainYearMonth().equals(ym)) {
      focusDate(to.toString());
    } else {
      pendingFocus.current = to.toString();
      go("month", to.toPlainYearMonth());
    }
  };
  const step = view === "year" ? { years: 1 } : { months: 1 };
  const unit = view === "year" ? "年" : "月";

  return (
    <dialog
      {...dialogProps}
      aria-label="日付を選ぶ"
      className={styles.dialog}
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const outside =
          e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
        // ::backdrop を押しても target は dialog 自身になるので、座標で枠の外かを見る。closedby は Safari が未対応
        if (e.target === e.currentTarget && outside) {
          e.currentTarget.close();
        }
      }}
    >
      <div className={styles.toolbar}>
        {view === "year" ? (
          <h2 className={styles.period}>
            <Morph name="period-year">{ym.year}年</Morph>
          </h2>
        ) : (
          <div className={styles.title}>
            <button
              className={styles.back}
              type="button"
              onClick={() => {
                go("year", ym);
              }}
            >
              <Chevron className={styles.prev} size={18} />
              <Morph name="period-year">{ym.year}年</Morph>
            </button>
            <h2 className={styles.period}>
              <Morph name="period-month">{ym.month}月</Morph>
            </h2>
          </div>
        )}
        <div className={styles.controls}>
          <HoverButton
            className={styles.today}
            disabled={view === "month" && ym.equals(thisMonth)}
            type="button"
            onClick={() => {
              go("month", thisMonth);
            }}
          >
            今日
          </HoverButton>
          <HoverButton
            aria-label={`前の${unit}`}
            className={styles.step}
            type="button"
            onClick={() => {
              go(view, ym.subtract(step));
            }}
          >
            <Chevron className={styles.prev} size={18} />
          </HoverButton>
          <HoverButton
            aria-label={`次の${unit}`}
            className={styles.step}
            type="button"
            onClick={() => {
              go(view, ym.add(step));
            }}
          >
            <Chevron className={styles.next} size={18} />
          </HoverButton>
        </div>
      </div>
      {view === "month" ? (
        <MonthView
          disabled={disabled}
          morph={morph}
          value={value}
          ym={ym}
          onKeyDown={move}
          onPick={(date) => {
            onPick(date);
            close();
          }}
          onShare={gatherWeekdays}
        />
      ) : (
        <YearView
          disabled={disabled}
          morph={morph}
          value={value}
          ym={ym}
          onOpenMonth={(m) => {
            go("month", m);
          }}
          onShare={gatherWeekdays}
        />
      )}
    </dialog>
  );
};
