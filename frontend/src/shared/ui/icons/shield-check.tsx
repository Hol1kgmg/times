import { motion } from "motion/react";
import type { Variants } from "motion/react";

import { getVariants, useAnimateIconContext, IconWrapper } from "@animate-ui/react/icons";
import type { IconProps } from "@animate-ui/react/icons";

type ShieldCheckProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    group: {
      initial: { scale: 1 },
      animate: {
        scale: [1, 0.92, 1.04, 1],
        transition: { duration: 0.6, ease: "easeInOut" },
      },
    },
    check: {
      initial: { pathLength: 1, opacity: 1 },
      animate: {
        pathLength: [0, 1],
        opacity: [0, 1],
        transition: { duration: 0.4, ease: "easeInOut", delay: 0.2 },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

const IconComponent = ({ size, ...props }: ShieldCheckProps) => {
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
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
        <motion.path
          animate={controls}
          d="m9 12 2 2 4-4"
          initial="initial"
          variants={variants.check}
        />
      </motion.g>
    </motion.svg>
  );
};

const ShieldCheck = (props: ShieldCheckProps) => <IconWrapper icon={IconComponent} {...props} />;

export {
  animations,
  ShieldCheck,
  ShieldCheck as ShieldCheckIcon,
  type ShieldCheckProps,
  type ShieldCheckProps as ShieldCheckIconProps,
};
