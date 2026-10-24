import { motion } from "motion/react";
import type { Variants } from "motion/react";

import { getVariants, useAnimateIconContext, IconWrapper } from "@animate-ui/react/icons";
import type { IconProps } from "@animate-ui/react/icons";

type HotBubbleProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    bubble: {
      initial: { rotate: 0 },
      animate: {
        // 炎につながったまま揺れるよう、しっぽの先 (左側面の中央) を軸にする
        transformOrigin: "0% 50%",
        rotate: [-12, 0],
        transition: { ease: "easeOut", duration: 0.25 },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

const IconComponent = ({ size = 20, ...props }: HotBubbleProps) => {
  const { controls } = useAnimateIconContext();
  const variants = getVariants(animations);

  return (
    <motion.svg
      fill="none"
      height={size}
      // 回すと右端が枠の上に出る。svg は既定で枠の外を切るので描かせる
      overflow="visible"
      viewBox="0 0 40 20"
      width={size * 2}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <motion.g animate={controls} initial="initial" variants={variants.bubble}>
        <path
          d="M9 1h26a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-2l-4-3 4-3V5a4 4 0 0 1 4-4z"
          fill="currentColor"
        />
        <text dominantBaseline="central" fontSize="11" textAnchor="middle" x="22" y="10">
          HOT
        </text>
      </motion.g>
    </motion.svg>
  );
};

const HotBubble = (props: HotBubbleProps) => <IconWrapper icon={IconComponent} {...props} />;

export { animations, HotBubble, type HotBubbleProps };
