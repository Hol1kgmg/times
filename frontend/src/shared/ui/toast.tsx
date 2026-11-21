import { flushSync } from "react-dom";
import {
  Button,
  Text,
  UNSTABLE_Toast as Toast,
  UNSTABLE_ToastContent as ToastContent,
  UNSTABLE_ToastList as ToastList,
  UNSTABLE_ToastQueue as ToastQueue,
  UNSTABLE_ToastRegion as ToastRegion,
} from "react-aria-components";
import type { QueuedToast } from "react-aria-components";
import styles from "./toast.module.css";

interface Notice {
  kind: "success" | "error";
  message: string;
}

const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const queue = new ToastQueue<Notice>({
  maxVisibleToasts: 3,
  // RAC の Toast は data-entering / data-exiting を持たず、出入りの動きは view transition でしか付けられない
  wrapUpdate: (fn) => {
    if (typeof document.startViewTransition !== "function" || reduceMotion()) {
      fn();
      return;
    }
    document.startViewTransition(() => {
      flushSync(fn);
    });
  },
});

const add = (notice: Notice, timeout?: number) => {
  // 連打や同じ失敗の繰り返しで、同じ文を積んで読み上げを重ねない
  if (queue.visibleToasts.some((t) => t.content.message === notice.message)) {
    return;
  }
  queue.add(notice, { timeout });
};

// 失敗は読み落とすと直せないので、自動では消さず閉じてもらう
export const toast = {
  success: (message: string) => {
    add({ kind: "success", message }, 5000);
  },
  error: (message: string) => {
    add({ kind: "error", message });
  },
  clear: () => {
    queue.clear();
  },
};

export const Toaster = () => (
  <ToastRegion className={styles.region} queue={queue}>
    <ToastList className={styles.list}>
      {({ toast: t }: { toast: QueuedToast<Notice> }) => (
        <Toast
          className={styles.toast}
          data-kind={t.content.kind}
          style={{ viewTransitionName: t.key }}
          toast={t}
        >
          <ToastContent className={styles.content}>
            <Text slot="title">
              {t.content.message.split(/(?<=。)/u).map((sentence) => (
                <span key={sentence} className={styles.sentence}>
                  {sentence}
                </span>
              ))}
            </Text>
          </ToastContent>
          <Button className={styles.close} slot="close">
            <svg
              aria-hidden="true"
              fill="none"
              height={16}
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth={2}
              viewBox="0 0 24 24"
              width={16}
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </Button>
        </Toast>
      )}
    </ToastList>
  </ToastRegion>
);
