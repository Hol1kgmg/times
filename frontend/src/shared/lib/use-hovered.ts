import { useHover } from "react-aria";
import type { HoverProps } from "react-aria";

// :hover はタップでも付いて残るので、操作ごとにタッチを除く useHover で判定する (adr/frontend/0007)
export const useHovered = (props: HoverProps = {}) => {
  const { hoverProps, isHovered } = useHover(props);
  return { ...hoverProps, "data-hovered": isHovered ? "" : undefined };
};
