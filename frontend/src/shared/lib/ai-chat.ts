export type AiService = "claude" | "chatgpt" | "grok";

const base: Record<AiService, string> = {
  claude: "https://claude.ai/new",
  chatgpt: "https://chatgpt.com/",
  grok: "https://grok.com/",
};

export const aiPrompt = ({ title, url }: { title: string; url: string }) =>
  "次の記事を日本語でわかりやすく解説してください。要点と背景、読むのに必要な用語を教えてください。記事を読めないときは、推測で答えずにその旨を教えてください。\n\n" +
  `タイトル: ${title}\nURL: ${url}`;

export const aiChatUrl = (service: AiService, prompt: string) =>
  `${base[service]}?${new URLSearchParams({ q: prompt })}`;
