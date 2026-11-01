import { Accessibility } from "@dnd-kit/dom";
import type { DragDropManagerInput } from "@dnd-kit/dom";

type Options = NonNullable<ConstructorParameters<typeof Accessibility>[1]>;
type Customize = Extract<
  NonNullable<DragDropManagerInput["plugins"]>,
  (...args: never[]) => unknown
>;

// dnd-kit の既定の読み上げは英語で、記事の id (UUID) をそのまま読む
const field = (data: unknown, key: "title" | "box") => {
  const value: unknown =
    typeof data === "object" && data !== null
      ? Object.entries(data).find(([k]) => k === key)?.[1]
      : undefined;
  return typeof value === "string" ? value : undefined;
};

const titleOf = (source: { data?: unknown } | null) =>
  `「${field(source?.data, "title") ?? "記事"}」`;
// 箱そのものの id は箱の名前、記事なら data に箱の名前を持たせている
const boxOf = (target: { id: unknown; data?: unknown } | null) =>
  field(target?.data, "box") ?? (target === null ? undefined : String(target.id));

export const plugins: Customize = (defaults) => [
  ...defaults.filter((p) => p !== Accessibility),
  Accessibility.configure({
    // configure() の引数は型が付かないので、コンストラクタの Options で縛る
    ...({
      screenReaderInstructions: {
        draggable:
          "スペースキーで持ち上げ、矢印キーで動かし、もう一度スペースキーで置きます。Esc キーでやめます。",
      },
      announcements: {
        dragstart: ({ operation: { source } }) => `${titleOf(source)}を持ち上げました`,
        dragover: ({ operation: { source, target } }) => {
          const box = boxOf(target);
          return box === undefined ? undefined : `${titleOf(source)}を ${box} の上に動かしました`;
        },
        dragend: ({ operation: { source, target }, canceled }) =>
          canceled
            ? `${titleOf(source)}を元の位置に戻しました`
            : `${titleOf(source)}を ${boxOf(target) ?? "元の箱"} に置きました`,
      },
    } satisfies Options),
  }),
];
