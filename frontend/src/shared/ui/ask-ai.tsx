import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { FocusScope, useHover } from "react-aria";
import { Button, Dialog, DialogTrigger, Link, Popover, Toolbar } from "react-aria-components";
import { aiChatUrl, aiPrompt } from "#/shared/lib/ai-chat";
import type { AiService } from "#/shared/lib/ai-chat";
import { reducedMotion } from "#/shared/lib/reduced-motion";
import { CopyToast, useCopyToast } from "./copy-toast";
import { AiBrandIcon } from "./icons/ai-brand";
import { BotMessageSquare } from "./icons/bot-message-square";
import styles from "./ask-ai.module.css";

const services: { id: AiService; name: string }[] = [
  { id: "claude", name: "Claude" },
  { id: "chatgpt", name: "ChatGPT" },
  { id: "grok", name: "Grok" },
];

const Choices = ({
  prompt,
  copied,
  onOpen,
  onCopy,
}: {
  prompt: string;
  copied: boolean;
  onOpen: () => void;
  onCopy: () => void;
}) => (
  <>
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
          onPress={onOpen}
        >
          <AiBrandIcon service={s.id} size={20} />
          {s.name}
        </Link>
      ))}
    </Toolbar>
    <CopyToast shown={copied}>
      <Button className={styles.copy} onPress={onCopy}>
        プロンプトをコピー
      </Button>
    </CopyToast>
  </>
);

// hover は覗いているだけなので、モーダルにしてフォーカスを奪わない (research R2)
type Mode = "hover" | "press";

export const AskAi = ({
  title,
  url,
  className,
}: {
  title: string;
  url: string;
  className?: string;
}) => {
  const [mode, setMode] = useState<Mode | null>(null);
  // 閉じるアニメーションの間も開いたときの形を保つ。途中で Dialog を外すとフォーカスの戻り先が消える
  const [shape, setShape] = useState<Mode>("hover");
  const openAs = (m: Mode) => {
    setMode(m);
    setShape(m);
  };
  // DialogTrigger は自分の押下を先に処理するので、外側の capture で押されたことを先に知る
  const pressed = useRef<"mouse" | "other" | null>(null);
  const closer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toast = useCopyToast();
  const prompt = aiPrompt({ title, url });

  const keep = () => {
    clearTimeout(closer.current);
  };
  const leave = () => {
    keep();
    closer.current = setTimeout(() => {
      setMode((m) => (m === "hover" ? null : m));
    }, 300);
  };
  useEffect(
    () => () => {
      clearTimeout(closer.current);
    },
    [],
  );

  // 非モーダルの Popover はフォーカスが中にないと Esc を受けない (WCAG 1.4.13)
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setMode(null);
      }
    };
    if (mode === "hover") {
      window.addEventListener("keydown", onKey);
    }
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [mode]);

  const { hoverProps } = useHover({ onHoverStart: keep, onHoverEnd: leave });

  // RAC がフォーカスをボタンへ戻すのは閉じるアニメーションの後なので、それまでボタンを隠さない
  const [holding, setHolding] = useState(false);
  const holder = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(
    () => () => {
      clearTimeout(holder.current);
    },
    [],
  );
  const close = () => {
    setMode(null);
    if (shape === "press") {
      setHolding(true);
      clearTimeout(holder.current);
      holder.current = setTimeout(() => {
        setHolding(false);
      }, 400);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      toast.show();
    } catch (error) {
      // 権限で断られたときは、コピーできたと示さなければ仕様を満たす
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        return;
      }
      throw error;
    }
  };
  const choices = (
    <Choices
      copied={toast.shown}
      prompt={prompt}
      onCopy={() => {
        void copy();
      }}
      onOpen={close}
    />
  );

  return (
    <span
      className={className === undefined ? styles.root : `${styles.root} ${className}`}
      data-holding={holding ? "" : undefined}
    >
      <DialogTrigger
        isOpen={mode !== null}
        onOpenChange={(open) => {
          const by = pressed.current;
          pressed.current = null;
          // 押して開いた形はホバーが外れても残るので、マウスではホバーだけで開閉する
          if (by === "mouse") {
            return;
          }
          // ホバーで開いた後に押されたら閉じずに、押して開いた形へ切り替える
          if (open || (mode === "hover" && by !== null)) {
            openAs("press");
          } else {
            close();
          }
        }}
      >
        <span
          className={styles.trigger}
          onKeyDownCapture={(e: KeyboardEvent) => {
            pressed.current = e.key === "Enter" || e.key === " " ? "other" : null;
          }}
          onPointerDownCapture={(e) => {
            pressed.current = e.pointerType === "mouse" ? "mouse" : "other";
          }}
        >
          <Button
            aria-label={`「${title}」を AI で解説`}
            className={styles.button}
            onHoverEnd={leave}
            onHoverStart={() => {
              keep();
              if (mode === null) {
                openAs("hover");
              }
            }}
          >
            {({ isHovered }) => (
              <BotMessageSquare animate={isHovered && !reducedMotion()} role="none" size={16} />
            )}
          </Button>
        </span>
        <Popover className={styles.card} isNonModal={shape === "hover"} placement="bottom start">
          {/* Dialog は開くとフォーカスを自分へ移すので、ホバーで開いたときは使わない */}
          {shape === "press" ? (
            <Dialog aria-label={`「${title}」を AI で解説`} className={styles.panel}>
              {/* 子のフォーカスが先に入るので、Dialog は自分へフォーカスを移さない */}
              <FocusScope autoFocus>{choices}</FocusScope>
            </Dialog>
          ) : (
            <div className={styles.panel} {...hoverProps}>
              {choices}
            </div>
          )}
        </Popover>
      </DialogTrigger>
    </span>
  );
};
