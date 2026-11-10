import { motion } from "motion/react";
import type { Variants } from "motion/react";

import { getVariants, useAnimateIconContext, IconWrapper } from "@animate-ui/react/icons";
import type { IconProps } from "@animate-ui/react/icons";

type ArchiveProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    lid: {
      initial: {
        y: 0,
        rotate: 0,
        transformOrigin: "2px 5.5px",
        transition: { duration: 0.15 },
      },
      animate: {
        y: [0, -1, 0],
        rotate: [0, -2, 0],
        transformOrigin: "2px 5.5px",
        transition: { duration: 0.5, times: [0, 0.4, 1], ease: "easeInOut" },
      },
    },
    body: {},
    handle: {},
  } satisfies Record<string, Variants>,
} as const;

const IconComponent = ({ size, ...props }: ArchiveProps) => {
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
      <motion.rect
        animate={controls}
        height="5"
        initial="initial"
        rx="1"
        style={{ transformBox: "view-box" }}
        variants={variants.lid}
        width="20"
        x="2"
        y="3"
      />
      <motion.path
        animate={controls}
        d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"
        initial="initial"
        variants={variants.body}
      />
      <motion.path animate={controls} d="M10 12h4" initial="initial" variants={variants.handle} />
    </motion.svg>
  );
};

const Archive = (props: ArchiveProps) => <IconWrapper icon={IconComponent} {...props} />;

export {
  animations,
  Archive,
  Archive as ArchiveIcon,
  type ArchiveProps,
  type ArchiveProps as ArchiveIconProps,
};
