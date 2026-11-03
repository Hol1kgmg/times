import { motion } from "motion/react";
import type { Variants } from "motion/react";

import { getVariants, useAnimateIconContext, IconWrapper } from "@animate-ui/react/icons";
import type { IconProps } from "@animate-ui/react/icons";

type TerminalProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path1: {
      initial: {
        opacity: 1,
      },
      animate: {
        opacity: [1, 0, 1, 0, 1],
        transition: {
          duration: 1.5,
          ease: "easeInOut",
        },
      },
    },
    path2: {},
  } satisfies Record<string, Variants>,
} as const;

const IconComponent = ({ size, ...props }: TerminalProps) => {
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
      <motion.path animate={controls} d="M12 19h8" initial="initial" variants={variants.path1} />
      <motion.path
        animate={controls}
        d="m4 17 6-6-6-6"
        initial="initial"
        variants={variants.path2}
      />
    </motion.svg>
  );
};

const Terminal = (props: TerminalProps) => <IconWrapper icon={IconComponent} {...props} />;

export {
  animations,
  Terminal,
  Terminal as TerminalIcon,
  type TerminalProps,
  type TerminalProps as TerminalIconProps,
};
