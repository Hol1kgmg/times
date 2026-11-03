import type { ComponentType } from "react";
import type { Category } from "#/shared/api";
import { Ellipsis } from "#/shared/ui/icons/ellipsis";
import { Palette } from "#/shared/ui/icons/palette";
import { Rocket } from "#/shared/ui/icons/rocket";
import { ShieldCheck } from "#/shared/ui/icons/shield-check";
import { Sparkles } from "#/shared/ui/icons/sparkles";
import { Terminal } from "#/shared/ui/icons/terminal";

export const categoryIcons: Record<
  Category,
  ComponentType<{ className?: string; role?: string; size?: number }>
> = {
  セキュリティ: ShieldCheck,
  IT系: Terminal,
  UI系: Palette,
  AI系: Sparkles,
  "面白そうなツール・サービス": Rocket,
  その他: Ellipsis,
};
