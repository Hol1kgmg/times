import type { AiService } from "#/shared/lib/ai-chat";

export const services: { id: AiService; name: string }[] = [
  { id: "claude", name: "Claude" },
  { id: "chatgpt", name: "ChatGPT" },
  { id: "grok", name: "Grok" },
];

export const copyPrompt = async (prompt: string, onCopied: () => void) => {
  try {
    await navigator.clipboard.writeText(prompt);
    onCopied();
  } catch (error) {
    // 権限で断られたときは、コピーできたと示さなければ仕様を満たす
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      return;
    }
    throw error;
  }
};

// 押して開いた形はホバーが外れても残るので、マウスの押下では開閉を切り替えない (frontend-ui-design.md)
// ホバーで開いた後のクリックは onOpenChange を通らずに開いたまま固定されるので、click の既定処理ごと止める
export const ignoreMouseClick = (event: { nativeEvent: Event; preventDefault: () => void }) => {
  if (event.nativeEvent instanceof PointerEvent && event.nativeEvent.pointerType === "mouse") {
    event.preventDefault();
  }
};
