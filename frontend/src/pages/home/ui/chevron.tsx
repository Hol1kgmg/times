// lucide の chevron-down (ISC)
export const Chevron = ({ className, size }: { className?: string; size: number }) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    height={size}
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    viewBox="0 0 24 24"
    width={size}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);
