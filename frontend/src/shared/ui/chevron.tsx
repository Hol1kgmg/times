import { LineIcon } from "#/shared/ui/icons/line-icon";

// lucide の chevron-down (ISC)
export const Chevron = ({ className, size }: { className?: string; size: number }) => (
  <LineIcon className={className} d="m6 9 6 6 6-6" size={size} />
);
