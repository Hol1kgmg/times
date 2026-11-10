import { useState } from "react";
import { ToggleButton } from "react-aria-components";
import { reducedMotion } from "#/shared/lib/reduced-motion";
import { BotMessageSquare } from "./icons/bot-message-square";
import { BotOff } from "./icons/bot-off";
import styles from "./ai-toggle.module.css";

export const AiToggle = ({
  isSelected,
  onChange,
}: {
  isSelected: boolean;
  onChange: (selected: boolean) => void;
}) => {
  // 読み込んだ直後は動かさない。off の動きは斜線を消した状態から始まる
  const [toggled, setToggled] = useState(false);
  const animate = toggled && !reducedMotion();
  return (
    <ToggleButton
      aria-label="AI のアイコンを表示"
      className={styles.toggle}
      isSelected={isSelected}
      onChange={(selected) => {
        setToggled(true);
        onChange(selected);
      }}
    >
      {isSelected ? (
        <BotMessageSquare animate={animate} role="none" size={20} />
      ) : (
        <BotOff animate={animate ? "off" : false} role="none" size={20} />
      )}
    </ToggleButton>
  );
};
