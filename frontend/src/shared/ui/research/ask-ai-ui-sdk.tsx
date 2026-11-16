import { useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@ui-sdk/react/popover";
import { Toolbar, ToolbarLink } from "@ui-sdk/react/toolbar";
import { aiChatUrl, aiPrompt } from "#/shared/lib/ai-chat";
import { useHovered } from "#/shared/lib/use-hovered";
import { CopyToast, useCopyToast } from "../copy-toast";
import { AiBrandIcon } from "../icons/ai-brand";
import { BotMessageSquare } from "../icons/bot-message-square";
import { copyPrompt, ignoreMouseClick, services } from "./choices";
import styles from "./research.module.css";

const Service = ({ id, name, prompt }: (typeof services)[number] & { prompt: string }) => (
  <ToolbarLink
    {...useHovered()}
    aria-label={`${name} で解説`}
    className={styles.service}
    href={aiChatUrl(id, prompt)}
    rel="noopener noreferrer"
    target="_blank"
  >
    <AiBrandIcon service={id} size={20} />
    {name}
  </ToolbarLink>
);

export const AskAiUiSdk = ({ title, url }: { title: string; url: string }) => {
  const prompt = aiPrompt({ title, url });
  const toast = useCopyToast();
  const content = useRef<HTMLDivElement>(null);
  const hovered = useHovered();
  const copyHovered = useHovered();

  return (
    <span className={styles.root}>
      <Popover
        closeDelay={300}
        delay={0}
        openOnHover
        onOpenChange={(open, details) => {
          // ホバーで開いた後のキー操作・タップは閉じずに、フォーカスをカードへ移す
          if (!open && details.reason === "trigger-press") {
            details.cancel();
            content.current?.querySelector<HTMLElement>("a, button")?.focus();
          }
        }}
      >
        <PopoverTrigger
          {...hovered}
          aria-label={`「${title}」を AI で解説`}
          className={styles.button}
          onClick={ignoreMouseClick}
        >
          <BotMessageSquare animate={hovered["data-hovered"] !== undefined} role="none" size={16} />
        </PopoverTrigger>
        <PopoverContent ref={content} align="start" className={styles.card} side="bottom">
          <p className={styles.heading}>AI に解説</p>
          <Toolbar aria-label="AI チャット" className={styles.services}>
            {services.map((s) => (
              <Service key={s.id} {...s} prompt={prompt} />
            ))}
          </Toolbar>
          <CopyToast shown={toast.shown}>
            <button
              {...copyHovered}
              className={styles.copy}
              type="button"
              onClick={() => {
                void copyPrompt(prompt, toast.show);
              }}
            >
              プロンプトをコピー
            </button>
          </CopyToast>
        </PopoverContent>
      </Popover>
    </span>
  );
};
