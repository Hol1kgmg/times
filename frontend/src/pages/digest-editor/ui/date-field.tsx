import { lazy, Suspense, useId, useState } from "react";
import { calendarIcon } from "#/shared/ui/icons/calendar";
import { LineIcon } from "#/shared/ui/icons/line-icon";
import styles from "./date-field.module.css";

// Temporal の polyfill が重いので、カレンダーを開くまで読まない
const DatePickerDialog = lazy(async () => {
  const { DatePickerDialog: Picker } = await import("#/shared/ui/date-picker");
  return { default: Picker };
});

interface DateFieldProps {
  value: string;
  invalid: boolean;
  taken: ReadonlySet<string>;
  onChange: (date: string) => void;
}

export const DateField = ({ value, invalid, taken, onChange }: DateFieldProps) => {
  const [picking, setPicking] = useState(false);
  const dateId = useId();
  return (
    <div className={styles.dateField}>
      {/* ボタンを label の中に入れると labelable な要素が 2 つになり不正なので、htmlFor で結ぶ */}
      <label className={styles.label} htmlFor={dateId}>
        日付
      </label>
      <div className={styles.dateBox}>
        <input
          aria-invalid={invalid}
          className={styles.input}
          id={dateId}
          required
          type="date"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
        />
        <button
          aria-label="カレンダーから選ぶ"
          className={styles.calendarButton}
          type="button"
          onClick={() => {
            setPicking(true);
          }}
        >
          <LineIcon d={calendarIcon} size={20} />
        </button>
      </div>
      {picking && (
        <Suspense>
          <DatePickerDialog
            disabled={taken}
            value={value}
            onClose={() => {
              setPicking(false);
            }}
            onPick={onChange}
          />
        </Suspense>
      )}
    </div>
  );
};
