import {
  addTransitionType,
  startTransition,
  useEffect,
  useRef,
  useState,
  ViewTransition,
} from "react";
import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import { parseDate } from "@internationalized/date";
import {
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  I18nProvider,
} from "react-aria-components";
import { Temporal } from "temporal-polyfill/implementation";
import { Chevron } from "#/shared/ui/chevron";
import { HoverButton } from "#/shared/ui/hover-button";
import { monthDays } from "#/shared/lib/month-days";
import styles from "./date-picker.module.css";
import { useModal } from "./modal";

const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

type View = "year" | "month";

interface MiniMonthProps {
  ym: Temporal.PlainYearMonth;
  value: string;
  named: boolean;
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

const MiniMonth = ({ ym, value, named }: MiniMonthProps) => {
  const { lead, days } = monthDays(ym.year, ym.month);
  return (
    <div aria-hidden className={styles.calendar}>
      {days.map((day, i) => {
        const date = day.toString();
        return (
          <span
            key={date}
            className={`${styles.cell} ${date === value ? styles.selected : ""}`}
            style={i === 0 ? { gridColumnStart: lead + 1 } : undefined}
          >
            <Morph name={named ? `day-${date}` : undefined}>{day.day}</Morph>
          </span>
        );
      })}
    </div>
  );
};

interface ViewProps {
  ym: Temporal.PlainYearMonth;
  value: string;
  morph: boolean;
  onShare: () => void;
}

const slide = { next: styles.slideNext, prev: styles.slidePrev, default: "none" };

const weekdaysAt = "[data-weekdays]";
const cardAt = (m: Temporal.PlainYearMonth) => `[data-month="${m.toString()}"]`;

const toCalendarDate = (date: Temporal.PlainDate) => parseDate(date.toString());

const MonthView = ({
  ym,
  value,
  disabled,
  morph,
  onShare,
  focused,
  onFocusChange,
  onPick,
}: ViewProps & {
  disabled: ReadonlySet<string>;
  focused: Temporal.PlainDate;
  onFocusChange: (date: Temporal.PlainDate) => void;
  onPick: (date: string) => void;
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
          {/* 週の始まりと読み上げを、閲覧者のブラウザの言語ではなく曜日の見出しに揃える */}
          <I18nProvider locale="ja-JP">
            <Calendar
              aria-label="日付"
              focusedValue={toCalendarDate(focused)}
              isDateUnavailable={(d) => disabled.has(d.toString())}
              value={value === "" ? null : parseDate(value)}
              onChange={(d) => {
                onPick(d.toString());
              }}
              onFocusChange={(d) => {
                onFocusChange(Temporal.PlainDate.from(d.toString()));
              }}
            >
              <ViewTransition key={ym.toString()} default="none" enter={slide} exit={slide}>
                <CalendarGrid className={styles.grid}>
                  <CalendarGridBody>
                    {(date) => (
                      <CalendarCell className={styles.cellLarge} date={date}>
                        {({ formattedDate, isOutsideMonth }) => (
                          <Morph
                            name={morph && !isOutsideMonth ? `day-${date.toString()}` : undefined}
                          >
                            {formattedDate}
                          </Morph>
                        )}
                      </CalendarCell>
                    )}
                  </CalendarGridBody>
                </CalendarGrid>
              </ViewTransition>
            </Calendar>
          </I18nProvider>
        </div>
      </ViewTransition>
    </div>
  </div>
);

const YearView = ({
  ym,
  value,
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
            <MiniMonth named={morph && m.equals(ym)} value={value} ym={m} />
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
  disabled: ReadonlySet<string>;
  onPick: (date: string) => void;
  onClose: () => void;
}) => {
  const { ref: dialogRef, dialogProps, close } = useModal(onClose);
  const today = Temporal.Now.plainDateISO();
  const [view, setView] = useState<View>("month");
  const [focused, setFocused] = useState(() =>
    value === "" ? today : Temporal.PlainDate.from(value),
  );
  const ym = focused.toPlainYearMonth();
  // useModal の showModal より後に動くよう、effect はその後に宣言する
  useEffect(() => {
    // showModal は先頭のボタン (年へ戻る) にフォーカスするので、Calendar が Tab の止まり先にしたセルへ移す
    dialogRef.current?.querySelector<HTMLElement>('[role="grid"] [tabindex="0"]')?.focus();
  }, [dialogRef]);

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
  const go = (v: View, to: Temporal.PlainDate) => {
    const toYm = to.toPlainYearMonth();
    // 別の年の月へは数字の行き先が年表示の DOM にないので、送りとして滑らせる
    const switching = v !== view && to.year === ym.year;
    if (switching) {
      leaving.current = center(view === "month" ? weekdaysAt : cardAt(toYm));
    }
    // 撮る前に名前を付け替える。年と月の切り替えは数字を 1 つずつ動かし、月送りは日付の面ごと滑らせる
    flushSync(() => {
      setMorph(switching);
      if (switching) {
        setFocused(to);
      }
    });
    startTransition(() => {
      addTransitionType("date-picker");
      if (!switching) {
        addTransitionType(Temporal.PlainYearMonth.compare(toYm, ym) > 0 ? "next" : "prev");
      }
      setView(v);
      setFocused(to);
    });
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
                go("year", focused);
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
            disabled={view === "month" && ym.equals(today.toPlainYearMonth())}
            type="button"
            onClick={() => {
              go("month", today);
            }}
          >
            今日
          </HoverButton>
          <HoverButton
            aria-label={`前の${unit}`}
            className={styles.step}
            type="button"
            onClick={() => {
              go(view, focused.subtract(step));
            }}
          >
            <Chevron className={styles.prev} size={18} />
          </HoverButton>
          <HoverButton
            aria-label={`次の${unit}`}
            className={styles.step}
            type="button"
            onClick={() => {
              go(view, focused.add(step));
            }}
          >
            <Chevron className={styles.next} size={18} />
          </HoverButton>
        </div>
      </div>
      {view === "month" ? (
        <MonthView
          disabled={disabled}
          focused={focused}
          morph={morph}
          value={value}
          ym={ym}
          onFocusChange={(date) => {
            // 矢印キーで月をまたぐときも、月送りのボタンと同じく滑らせる
            if (date.toPlainYearMonth().equals(ym)) {
              setFocused(date);
            } else {
              go("month", date);
            }
          }}
          onPick={(date) => {
            onPick(date);
            close();
          }}
          onShare={gatherWeekdays}
        />
      ) : (
        <YearView
          morph={morph}
          value={value}
          ym={ym}
          onOpenMonth={(m) => {
            go("month", focused.with({ month: m.month }));
          }}
          onShare={gatherWeekdays}
        />
      )}
    </dialog>
  );
};
