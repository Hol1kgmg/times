import { motion } from "motion/react";
import type { Variants } from "motion/react";

import { getVariants, useAnimateIconContext, IconWrapper } from "@animate-ui/react/icons";
import type { IconProps } from "@animate-ui/react/icons";

type GlobeProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    meridian: {
      initial: { scaleX: 1 },
      animate: {
        scaleX: [1, 0.1, 1, 0.1, 1],
        transition: { duration: 1, ease: "easeInOut" },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

const IconComponent = ({ size, ...props }: GlobeProps) => {
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
      <circle cx={12} cy={12} r={10} />
      <path d="M2 12h20" />
      <motion.path
        animate={controls}
        d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"
        initial="initial"
        variants={variants.meridian}
      />
    </motion.svg>
  );
};

const Globe = (props: GlobeProps) => <IconWrapper icon={IconComponent} {...props} />;

export {
  animations,
  Globe,
  Globe as GlobeIcon,
  type GlobeProps,
  type GlobeProps as GlobeIconProps,
};
