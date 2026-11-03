import { memoLinkPreview } from "#/shared/lib/memo-link-preview";
import { fetchAnyLinkPreview } from "./fetch-any-link-preview";

export const loadAnyLinkPreview = memoLinkPreview(fetchAnyLinkPreview);
