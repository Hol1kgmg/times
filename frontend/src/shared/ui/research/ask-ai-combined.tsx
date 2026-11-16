import { useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@ui-sdk/react/popover";
import { Button, Link, Toolbar } from "react-aria-components";
import { aiChatUrl, aiPrompt } from "#/shared/lib/ai-chat";
import { CopyToast, useCopyToast } from "../copy-toast";
import { AiBrandIcon } from "../icons/ai-brand";
import { BotMessageSquare } from "../icons/bot-message-square";
import { copyPrompt, ignoreMouseClick, services } from "./choices";
import styles from "./research.module.css";

// 開閉・ホバー・位置・閉じる操作は UI SDK、カードの中のフォーカスとキー操作と状態の属性は RAC が持つ
export const AskAiCombined = ({
  title,
  url,
  racTrigger,
}: {
  title: string;
  url: string;
  // 同じ要素に両方の props と ref を当てるか (true: RAC の Button を UI SDK の render に渡す)
  racTrigger: boolean;
}) => {
  const prompt = aiPrompt({ title, url });
  const toast = useCopyToast();
  const content = useRef<HTMLDivElement>(null);
  const icon = <BotMessageSquare role="none" size={16} />;

  return (
    <span className={styles.root}>
      <Popover
        closeDelay={300}
        delay={0}
        openOnHover
        onOpenChange={(open, details) => {
          if (!open && details.reason === "trigger-press") {
            details.cancel();
            content.current?.querySelector<HTMLElement>("a, button")?.focus();
          }
        }}
      >
        <PopoverTrigger
          aria-label={`「${title}」を AI で解説`}
          className={styles.button}
          render={
            racTrigger ? (
              <Button
                onKeyDown={(e) => {
                  // RAC はキーの伝播を既定で止め、document で Escape を待つ UI SDK のレイヤーに届かない
                  if (e.key === "Escape") {
                    e.continuePropagation();
                  }
                }}
              />
            ) : undefined
          }
          onClick={ignoreMouseClick}
        >
          {icon}
        </PopoverTrigger>
        <PopoverContent ref={content} align="start" className={styles.card} side="bottom">
          <p className={styles.heading}>AI に解説</p>
          <Toolbar aria-label="AI チャット" className={styles.services}>
            {services.map((s) => (
              <Link
                key={s.id}
                aria-label={`${s.name} で解説`}
                className={styles.service}
                href={aiChatUrl(s.id, prompt)}
                rel="noopener noreferrer"
                target="_blank"
              >
                <AiBrandIcon service={s.id} size={20} />
                {s.name}
              </Link>
            ))}
          </Toolbar>
          <CopyToast shown={toast.shown}>
            <Button
              className={styles.copy}
              onPress={() => {
                void copyPrompt(prompt, toast.show);
              }}
            >
              プロンプトをコピー
            </Button>
          </CopyToast>
        </PopoverContent>
      </Popover>
    </span>
  );
};
