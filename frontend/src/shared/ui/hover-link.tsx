import { createLink } from "@tanstack/react-router";
import type { ComponentProps } from "react";
import { mergeProps } from "react-aria";
import { useHovered } from "#/shared/lib/use-hovered";

const HoverAnchor = ({ children, ...props }: ComponentProps<"a">) => (
  <a {...mergeProps(props, useHovered())}>{children}</a>
);

export const HoverLink = createLink(HoverAnchor);
