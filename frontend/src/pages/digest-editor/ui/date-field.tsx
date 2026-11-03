import { parseDate } from "@internationalized/date";
import type { CalendarDate } from "@internationalized/date";
import { lazy, Suspense, use, useEffect, useState } from "react";
import {
  DateField as AriaDateField,
  Button,
  DateFieldStateContext,
  DateInput,
  DateSegment,
  I18nProvider,
  Label,
} from "react-aria-components";
import { calendarIcon } from "#/shared/ui/icons/calendar";
import { LineIcon } from "#/shared/ui/icons/line-icon";
import styles from "./date-field.module.css";

// Temporal の polyfill が重いので、カレンダーを開くまで読まない
const DatePickerDialog = lazy(async () => {
  const { DatePickerDialog: Picker } = await import("#/shared/ui/date-picker");
  return { default: Picker };
});

const toDate = (value: string) => (value === "" ? null : parseDate(value));

// DateField は欠けた欄があっても onChange を呼ばず前の値を持ち続けるので、<input type="date"> と同じく空として渡す
const ReportShown = ({ onShown }: { onShown: (date: string) => void }) => {
  const state = use(DateFieldStateContext);
  const complete = state?.segments.every((s) => !s.isEditable || !s.isPlaceholder) ?? false;
  const shown = complete ? (state?.value?.toString() ?? "") : "";
  useEffect(() => {
    // oxlint-disable-next-line react-you-might-not-need-an-effect/no-pass-data-to-parent -- 欄の状態は DateField の context の中にしかない
    onShown(shown);
  }, [onShown, shown]);
  return null;
};

interface DateFieldProps {
  value: string;
  invalid: boolean;
  taken: ReadonlySet<string>;
  onChange: (date: string) => void;
}

export const DateField = ({ value, invalid, taken, onChange }: DateFieldProps) => {
  const [picking, setPicking] = useState(false);
  const [date, setDate] = useState<CalendarDate | null>(() => toDate(value));
  const [reported, setReported] = useState(value);
  // 欠けた欄を空として渡した値が戻ってきても、入力途中の欄を消さない
  if (value !== reported) {
    setReported(value);
    setDate(toDate(value));
  }
  const report = (next: string) => {
    if (next !== value) {
      setReported(next);
      onChange(next);
    }
  };
  return (
    <>
      <I18nProvider locale="ja-JP">
        <AriaDateField<CalendarDate>
          className={styles.dateField}
          isInvalid={invalid}
          isRequired
          shouldForceLeadingZeros
          value={date}
          onChange={setDate}
        >
          {/* oxlint-disable-next-line jsx-a11y/label-has-associated-control -- DateField が aria-labelledby で欄の group に結ぶ */}
          <Label className={styles.label} elementType="span">
            日付
          </Label>
          <div className={styles.dateBox}>
            <DateInput className={styles.input}>
              {(segment) => <DateSegment className={styles.segment} segment={segment} />}
            </DateInput>
            <Button
              aria-label="カレンダーから選ぶ"
              className={styles.calendarButton}
              onPress={() => {
                setPicking(true);
              }}
            >
              <LineIcon d={calendarIcon} size={20} />
            </Button>
          </div>
          <ReportShown onShown={report} />
        </AriaDateField>
      </I18nProvider>
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
    </>
  );
};
