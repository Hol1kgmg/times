import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { withMarkdownNotFound } from "./app/markdown-not-found.server";

export default createServerEntry({ fetch: withMarkdownNotFound(handler.fetch) });
