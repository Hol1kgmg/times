import { motion } from "motion/react";
import type { Variants } from "motion/react";

import { getVariants, useAnimateIconContext, IconWrapper } from "@animate-ui/react/icons";
import type { IconProps } from "@animate-ui/react/icons";

type RepeatProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    group: {
      initial: { rotate: 0 },
      animate: { rotate: 180, transition: { duration: 0.5, ease: "easeInOut" } },
    },
  } satisfies Record<string, Variants>,
} as const;

const IconComponent = ({ size, ...props }: RepeatProps) => {
  const { controls } = useAnimateIconContext();
  const variants = getVariants(animations);

  return (
    <motion.svg
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <motion.g animate={controls} initial="initial" variants={variants.group}>
        <path d="m17 2 4 4-4 4" />
        <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
        <path d="m7 22-4-4 4-4" />
        <path d="M21 13v1a4 4 0 0 1-4 4H3" />
      </motion.g>
    </motion.svg>
  );
};

const Repeat = (props: RepeatProps) => <IconWrapper icon={IconComponent} {...props} />;

export {
  animations,
  Repeat,
  Repeat as RepeatIcon,
  type RepeatProps,
  type RepeatProps as RepeatIconProps,
};
