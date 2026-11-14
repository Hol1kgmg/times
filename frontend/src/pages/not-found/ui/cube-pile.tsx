import type { RefObject } from "react";
import { useEffect, useRef } from "react";
import type { startCubePile } from "./cube-scene";
import styles from "./cube-pile.module.css";

const start = async (
  area: HTMLElement,
  ceiling: HTMLElement | null,
  urls: readonly string[],
  signal: AbortSignal,
  onFail: () => void,
) => {
  let run: typeof startCubePile;
  try {
    ({ startCubePile: run } = await import("./cube-scene"));
  } catch {
    // chunk を取れないときも、2D の山で 404 は成り立つ
    onFail();
    return;
  }
  if (!signal.aborted) {
    await run(area, ceiling, urls, signal, onFail, styles.canvas ?? "");
  }
};

export const CubePile = ({
  urls,
  ceiling,
  onFail,
}: {
  urls: readonly string[];
  ceiling: RefObject<HTMLElement | null>;
  onFail: () => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    if (ref.current !== null) {
      void start(ref.current, ceiling.current, urls, controller.signal, onFail);
    }
    return () => {
      controller.abort();
    };
  }, [urls, ceiling, onFail]);

  return <div ref={ref} aria-hidden="true" className={styles.pile} />;
};
