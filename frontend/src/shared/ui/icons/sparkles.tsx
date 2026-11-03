import { motion } from "motion/react";
import type { Variants } from "motion/react";

import { getVariants, useAnimateIconContext, IconWrapper } from "@animate-ui/react/icons";
import type { IconProps } from "@animate-ui/react/icons";

type SparklesProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    group: {
      initial: { scale: 1 },
      animate: {
        scale: [1, 0.9, 1.1, 1],
        transition: { duration: 0.6, ease: "easeInOut" },
      },
    },
    path: {},
    plus: {
      initial: { scale: 1, rotate: 0 },
      animate: {
        scale: [1, 0.7, 1.2, 1],
        rotate: [0, 90],
        transition: { duration: 0.6, ease: "easeInOut", delay: 0.15 },
      },
    },
    circle: {
      initial: { scale: 1 },
      animate: {
        scale: [1, 0.7, 1.2, 1],
        transition: { duration: 0.6, ease: "easeInOut", delay: 0.15 },
      },
    },
  } satisfies Record<string, Variants>,
  blink: {
    group: {
      initial: {
        scale: 1,
      },
      animate: {
        scale: [1, 0.9, 1.1, 1],
        transition: { duration: 0.6, ease: "easeInOut" },
      },
    },
    path: {},
    plus: {
      initial: { opacity: 1, scale: 1 },
      animate: {
        opacity: 0,
        scale: 0,
        transition: {
          opacity: {
            duration: 0.2,
            ease: "easeInOut",
            repeat: 1,
            repeatType: "reverse",
            repeatDelay: 0.2,
            delay: 0.15,
          },
          scale: {
            duration: 0.2,
            ease: "easeInOut",
            repeat: 1,
            repeatType: "reverse",
            repeatDelay: 0.2,
            delay: 0.15,
          },
        },
      },
    },
    circle: {
      initial: { opacity: 1, scale: 1 },
      animate: {
        opacity: 0,
        scale: 0,
        transition: {
          opacity: {
            duration: 0.2,
            ease: "easeInOut",
            repeat: 1,
            repeatType: "reverse",
            repeatDelay: 0.2,
          },
          scale: {
            duration: 0.2,
            ease: "easeInOut",
            repeat: 1,
            repeatType: "reverse",
            repeatDelay: 0.2,
          },
        },
      },
    },
  } satisfies Record<string, Variants>,
  fill: {
    group: {
      initial: {
        scale: 1,
      },
      animate: {
        scale: [1, 0.9, 1.1, 1],
        transition: { duration: 0.6, ease: "easeInOut" },
      },
    },
    path: {
      initial: {
        fill: "currentColor",
        fillOpacity: 0,
      },
      animate: {
        fillOpacity: 1,
        transition: { delay: 0.2 },
      },
    },
    plus: {
      initial: { opacity: 1, scale: 1 },
      animate: {
        opacity: 0,
        scale: 0,
        transition: {
          opacity: {
            duration: 0.2,
            ease: "easeInOut",
            repeat: 1,
            repeatType: "reverse",
            repeatDelay: 0.2,
            delay: 0.15,
          },
          scale: {
            duration: 0.2,
            ease: "easeInOut",
            repeat: 1,
            repeatType: "reverse",
            repeatDelay: 0.2,
            delay: 0.15,
          },
        },
      },
    },
    circle: {
      initial: {
        fill: "currentColor",
        fillOpacity: 0,
        opacity: 1,
        scale: 1,
      },
      animate: {
        fillOpacity: 1,
        opacity: 0,
        scale: 0,
        transition: {
          fillOpacity: { delay: 0.2 },
          opacity: {
            duration: 0.2,
            ease: "easeInOut",
            repeat: 1,
            repeatType: "reverse",
            repeatDelay: 0.2,
          },
          scale: {
            duration: 0.2,
            ease: "easeInOut",
            repeat: 1,
            repeatType: "reverse",
            repeatDelay: 0.2,
          },
        },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

const IconComponent = ({ size, ...props }: SparklesProps) => {
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
          d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"
          initial="initial"
          variants={variants.path}
        />
      </motion.g>
      <motion.path
        animate={controls}
        d="M20 2v4 M22 4h-4"
        initial="initial"
        variants={variants.plus}
      />
      <motion.circle
        animate={controls}
        cx="4"
        cy="20"
        initial="initial"
        r="2"
        variants={variants.circle}
      />
    </motion.svg>
  );
};

const Sparkles = (props: SparklesProps) => <IconWrapper icon={IconComponent} {...props} />;

export {
  animations,
  Sparkles,
  Sparkles as SparklesIcon,
  type SparklesProps,
  type SparklesProps as SparklesIconProps,
};
