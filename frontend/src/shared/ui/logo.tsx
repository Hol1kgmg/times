import { useId } from "react";
import styles from "./logo.module.css";

interface Props {
  variant?: "hero" | "hover";
}

const wordmarkFont = "'Arial Rounded MT Bold', 'Helvetica Rounded', Arial, sans-serif";
const bellPath =
  "M284.4 150.3 C263 150.3 252.3 167.4 252.3 186.7 V199.6 L243.7 210.3 H325.1 L316.6 199.6 V186.7 C316.6 167.4 305.9 150.3 284.4 150.3 Z";

// docs/logo.svg を React 化したもの。形を変えるときは docs/logo.svg を直してから写す
export const Logo = ({ variant }: Props) => {
  const clip = useId();
  const cls = (name: keyof typeof styles) => (variant === "hover" ? styles[name] : undefined);
  return (
    <svg
      className={styles[variant ?? "logo"]}
      viewBox="100 118 990 250"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>z_times.dev</title>
      <defs>
        <clipPath id={clip}>
          <rect height="200" rx="51.4" width="200" x="113" y="156" />
        </clipPath>
      </defs>
      <g className={cls("icon")}>
        <rect fill="#ff6b35" height="200" rx="51.4" width="200" x="113" y="156" />
        <rect fill="#fff" height="28.6" rx="14.3" width="120" x="153" y="193.1" />
        <path
          d="M258.7 207.4 L167.3 304.6"
          fill="none"
          stroke="#fff"
          strokeLinecap="round"
          strokeWidth="28.6"
        />
        <rect fill="#fff" height="28.6" rx="14.3" width="120" x="153" y="290.3" />
        <g clipPath={`url(#${clip})`}>
          <g className={cls("dot")}>
            <circle cx="284.4" cy="184.6" fill="#ff6b35" r="23.6" />
            <circle cx="284.4" cy="184.6" fill="#ffc21a" r="18.6" />
          </g>
        </g>
      </g>
      <g className={cls("bell")} opacity="0">
        <g className={cls("bellBody")}>
          <path d={bellPath} fill="#fff" stroke="#fff" strokeLinejoin="round" strokeWidth="14" />
          <path d={bellPath} fill="#ffc21a" />
          <circle cx="284.4" cy="141.7" fill="#ffc21a" r="11.8" stroke="#fff" strokeWidth="6" />
          <circle cx="284.4" cy="223.1" fill="#ffc21a" r="13.9" stroke="#fff" strokeWidth="6" />
        </g>
      </g>
      <text
        className={cls("main")}
        fill="currentColor"
        fontFamily={wordmarkFont}
        fontSize="140"
        fontWeight="700"
        x="353"
        y="306"
      >
        z_times
      </text>
      <text
        className={cls("dev")}
        fill="#ff6b35"
        fontFamily={wordmarkFont}
        fontSize="90"
        fontWeight="700"
        x="870"
        y="306"
      >
        .dev
      </text>
    </svg>
  );
};
