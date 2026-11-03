import { motion } from "motion/react";
import type { Variants } from "motion/react";

import { getVariants, useAnimateIconContext, IconWrapper } from "@animate-ui/react/icons";
import type { IconProps } from "@animate-ui/react/icons";

type EllipsisProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    group: {
      initial: {
        rotate: 0,
        transition: { type: "spring", stiffness: 60, damping: 10 },
      },
      animate: {
        rotate: 180,
        transition: { type: "spring", stiffness: 60, damping: 10 },
      },
    },
    circle1: {},
    circle2: {},
    circle3: {},
  } satisfies Record<string, Variants>,
  vertical: {
    group: {
      initial: {
        rotate: 0,
        transition: { type: "spring", stiffness: 100, damping: 12 },
      },
      animate: {
        rotate: 90,
        transition: { type: "spring", stiffness: 100, damping: 12 },
      },
    },
    circle1: {},
    circle2: {},
    circle3: {},
  } satisfies Record<string, Variants>,
  jump: {
    group: {},
    circle1: {
      initial: {
        y: 0,
      },
      animate: {
        y: [0, -2, 2],
        transition: {
          duration: 1.2,
          delay: 0.4,
          repeat: Infinity,
          repeatType: "mirror",
          ease: "easeInOut",
        },
      },
    },
    circle2: {
      initial: {
        y: 0,
      },
      animate: {
        y: [0, -2, 2],
        transition: {
          duration: 1.2,
          delay: 0.2,
          repeat: Infinity,
          repeatType: "mirror",
          ease: "easeInOut",
        },
      },
    },
    circle3: {
      initial: {
        y: 0,
      },
      animate: {
        y: [0, -2, 2],
        transition: {
          duration: 1.2,
          repeat: Infinity,
          repeatType: "mirror",
          ease: "easeInOut",
        },
      },
    },
  } satisfies Record<string, Variants>,
  pulse: {
    group: {},
    circle1: {
      initial: {
        scale: 1,
      },
      animate: {
        scale: [1, 1.5, 1],
        transition: {
          duration: 1,
          delay: 0.4,
          ease: "easeInOut",
        },
      },
    },
    circle2: {
      initial: {
        scale: 1,
      },
      animate: {
        scale: [1, 1.5, 1],
        transition: {
          duration: 1,
          delay: 0.2,
          ease: "easeInOut",
        },
      },
    },
    circle3: {
      initial: {
        scale: 1,
      },
      animate: {
        scale: [1, 1.5, 1],
        transition: {
          duration: 1,
          ease: "easeInOut",
        },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

const IconComponent = ({ size, ...props }: EllipsisProps) => {
  const { controls } = useAnimateIconContext();
  const variants = getVariants(animations);

  return (
    <motion.svg
      animate={controls}
      fill="none"
      height={size}
      initial="initial"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      variants={variants.group}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <motion.circle
        animate={controls}
        cx={19}
        cy={12}
        initial="initial"
        r={1}
        variants={variants.circle1}
      />
      <motion.circle
        animate={controls}
        cx={12}
        cy={12}
        initial="initial"
        r={1}
        variants={variants.circle2}
      />
      <motion.circle
        animate={controls}
        cx={5}
        cy={12}
        initial="initial"
        r={1}
        variants={variants.circle3}
      />
    </motion.svg>
  );
};

const Ellipsis = (props: EllipsisProps) => <IconWrapper icon={IconComponent} {...props} />;

export {
  animations,
  Ellipsis,
  Ellipsis as EllipsisIcon,
  type EllipsisProps,
  type EllipsisProps as EllipsisIconProps,
};
