import { motion } from "motion/react";
import type { Variants } from "motion/react";

import { getVariants, useAnimateIconContext, IconWrapper } from "@animate-ui/react/icons";
import type { IconProps } from "@animate-ui/react/icons";

type ZapProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    group: {
      initial: { scale: 1 },
      animate: {
        scale: [1, 0.9, 1.15, 1],
        transition: { duration: 0.6, ease: "easeInOut" },
      },
    },
    path: {},
  } satisfies Record<string, Variants>,
  fill: {
    group: {
      initial: { scale: 1 },
      animate: {
        scale: [1, 0.9, 1.15, 1],
        transition: { duration: 0.6, ease: "easeInOut" },
      },
    },
    path: {
      initial: { fill: "currentColor", fillOpacity: 0 },
      animate: { fillOpacity: 1, transition: { delay: 0.2 } },
    },
  } satisfies Record<string, Variants>,
  shake: {
    group: {
      initial: { scale: 1, rotate: 0 },
      animate: {
        scale: [1, 0.9, 1.08, 0.98, 1],
        rotate: [0, -8, 8, -4, 0],
        transition: { duration: 0.5, ease: "easeInOut" },
      },
    },
    path: {},
  } satisfies Record<string, Variants>,
} as const;

const IconComponent = ({ size, ...props }: ZapProps) => {
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
          d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z"
          initial="initial"
          variants={variants.path}
        />
      </motion.g>
    </motion.svg>
  );
};

const Zap = (props: ZapProps) => <IconWrapper icon={IconComponent} {...props} />;

export { animations, Zap, Zap as ZapIcon, type ZapProps, type ZapProps as ZapIconProps };
