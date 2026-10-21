import { motion } from "motion/react";
import type { Variants } from "motion/react";

import { getVariants, useAnimateIconContext, IconWrapper } from "@animate-ui/react/icons";
import type { IconProps } from "@animate-ui/react/icons";

type RocketProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    group: {
      initial: { x: 0, y: 0, transition: { duration: 0.3, ease: "easeInOut" } },
      animate: {
        x: [0, -0.3, 0.3, -0.3, 0.3, 0.8],
        y: [0, 0.3, -0.3, 0.3, -0.3, -0.8],
        transition: { duration: 0.6, ease: "easeInOut" },
      },
    },
    path1: {},
    path2: {},
    path3: {},
    trails: {
      initial: { scale: 1, x: 0, y: 0, transformOrigin: "100% 0%" },
      animate: {
        scale: [1, 0.6, 1.1, 1],
        x: [0, 0, 0, 0.8],
        y: [0, 0, 0, -0.8],
        transformOrigin: "100% 0%",
        transition: { duration: 0.6, ease: "easeInOut" },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

const IconComponent = ({ size, ...props }: RocketProps) => {
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
        <motion.path
          animate={controls}
          d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"
          initial="initial"
          variants={variants.path1}
        />
        <motion.path
          animate={controls}
          d="M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z"
          initial="initial"
          variants={variants.path2}
        />
        <motion.path
          animate={controls}
          d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05"
          initial="initial"
          variants={variants.path3}
        />
      </motion.g>
      <motion.path
        animate={controls}
        d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09"
        initial="initial"
        variants={variants.trails}
      />
    </motion.svg>
  );
};

const Rocket = (props: RocketProps) => <IconWrapper icon={IconComponent} {...props} />;

export {
  animations,
  Rocket,
  Rocket as RocketIcon,
  type RocketProps,
  type RocketProps as RocketIconProps,
};
