import { memoLinkPreview } from "#/shared/lib/memo-link-preview";
import { fetchDraftPreview } from "./fetch-draft-preview";

export const loadDraftPreview = memoLinkPreview(fetchDraftPreview);
