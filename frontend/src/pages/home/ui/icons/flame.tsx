import { motion } from "motion/react";
import type { Variants } from "motion/react";

import { getVariants, useAnimateIconContext, IconWrapper } from "@animate-ui/react/icons";
import type { IconProps } from "@animate-ui/react/icons";

type FlameProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    flame: {
      initial: { scaleY: 1, skewX: 0, transformOrigin: "50% 100%" },
      animate: {
        scaleY: [1, 1.05, 0.95, 1.03, 1],
        skewX: [0, 3, -3, 1.5, 0],
        transformOrigin: "50% 100%",
        transition: { duration: 0.8, ease: "easeInOut" },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

const IconComponent = ({ size, ...props }: FlameProps) => {
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
      <motion.path
        animate={controls}
        d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"
        initial="initial"
        variants={variants.flame}
      />
    </motion.svg>
  );
};

const Flame = (props: FlameProps) => <IconWrapper icon={IconComponent} {...props} />;

export {
  animations,
  Flame,
  Flame as FlameIcon,
  type FlameProps,
  type FlameProps as FlameIconProps,
};
