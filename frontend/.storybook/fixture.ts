import type { z } from "zod";

// parse の引数は unknown なので、schema に必須の項目が増えても story のデータの欠けを型検査で気付けない
export const fixture = <S extends z.ZodType>(schema: S, value: z.input<S>): z.output<S> =>
  schema.parse(value);
