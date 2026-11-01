import { Suspense, useState, useSyncExternalStore } from "react";
import type { LinkPreview } from "#/shared/lib/parse-link-preview";
import { PreviewCard } from "./preview-card";

let escapes = 0;
const subscribers = new Set<() => void>();
const onKeyDown = (e: KeyboardEvent) => {
  if (e.key !== "Escape") {
    return;
  }
  escapes += 1;
  for (const notify of subscribers) {
    notify();
  }
};
// 行ごとに登録すると記事の数だけリスナーが増えるので、document には 1 つだけ付ける
const subscribe = (notify: () => void) => {
  if (subscribers.size === 0) {
    document.addEventListener("keydown", onKeyDown);
  }
  subscribers.add(notify);
  return () => {
    subscribers.delete(notify);
    if (subscribers.size === 0) {
      document.removeEventListener("keydown", onKeyDown);
    }
  };
};

// カードはリンクの下の行を覆うので、ポインターやフォーカスを動かさずに消せるようにする (WCAG 1.4.13)
export const useLinkPreview = ({
  url,
  title,
  className,
  load,
}: {
  url: string;
  title: string;
  className: string;
  load: (url: string) => Promise<LinkPreview | null>;
}) => {
  const escaped = useSyncExternalStore(
    subscribe,
    () => escapes,
    () => 0,
  );
  const [shownAt, setShownAt] = useState<number | null>(null);
  const show = () => {
    setShownAt(escapes);
  };
  return {
    show,
    dismissed: shownAt !== null && shownAt !== escaped,
    card: shownAt !== null && (
      <Suspense fallback={null}>
        <PreviewCard className={className} preview={load(url)} title={title} url={url} />
      </Suspense>
    ),
  };
};
