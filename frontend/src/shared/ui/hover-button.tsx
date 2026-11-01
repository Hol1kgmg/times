import type { ComponentProps } from "react";
import { mergeProps } from "react-aria";
import { useHovered } from "#/shared/lib/use-hovered";

export const HoverButton = (props: ComponentProps<"button">) => (
  // oxlint-disable-next-line react/button-has-type -- type は呼び出し側が渡す
  <button {...mergeProps(props, useHovered())} />
);
