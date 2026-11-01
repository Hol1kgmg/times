import { memoLinkPreview } from "#/shared/lib/memo-link-preview";
import { getLinkPreview } from "./get-link-preview";

export const loadLinkPreview = memoLinkPreview(getLinkPreview);
