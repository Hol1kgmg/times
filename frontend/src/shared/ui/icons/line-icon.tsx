export const LineIcon = ({
  className,
  d,
  size,
}: {
  className?: string;
  d: string;
  size: number;
}) => (
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
    <path d={d} />
  </svg>
);
