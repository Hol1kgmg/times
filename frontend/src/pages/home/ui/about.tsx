import { AnimateIcon } from "@animate-ui/react/icons";
import { useId, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { category } from "#/shared/api/schemas";
import type { Category } from "#/shared/api/schemas";
import styles from "./about.module.css";
import { Chevron } from "./chevron";
import { Ellipsis } from "./icons/ellipsis";
import { Flame } from "./icons/flame";
import { Palette } from "./icons/palette";
import { Rocket } from "./icons/rocket";
import { ShieldCheck } from "./icons/shield-check";
import { Sparkles } from "./icons/sparkles";
import { Terminal } from "./icons/terminal";

const categoryDetails = {
  ホットトピック: { Icon: Flame, text: "その日いちばん盛り上がってたもの" },
  セキュリティ: { Icon: ShieldCheck, text: "注意喚起とか脆弱性の話" },
  IT系: { Icon: Terminal, text: "設計や開発まわりの記事・スライド" },
  UI系: { Icon: Palette, text: "デザインやフロントエンドの表現" },
  AI系: { Icon: Sparkles, text: "AI とかエージェントまわり" },
  "面白そうなツール・サービス": { Icon: Rocket, text: "ちょっと触ってみたいもの" },
  その他: { Icon: Ellipsis, text: "どれにも入らなかったもの" },
} satisfies Record<
  Category,
  { Icon: ComponentType<{ className?: string; size?: number }>; text: string }
>;

const faqs = [
  {
    q: "どうやって見ればいい？",
    a: "記事はカテゴリごとに並んでます。押すと元のページが別タブで開きます。",
  },
  {
    q: "過去の分は見られる？",
    a: "今はまだ見られません。いちばん新しい 1 日分だけ出してます。",
  },
  {
    q: "どのくらい更新される？",
    a: "決まってません。気になる記事がたまったらまとめてます。",
  },
  {
    q: "誰がやってる？",
    a: (
      <>
        Hol1kgmg がひとりでやってます (
        <a href="https://github.com/Hol1kgmg" rel="noopener noreferrer" target="_blank">
          GitHub
        </a>
        )。
      </>
    ),
  },
];

// <details> は閉じると中身が描画されず、閉じる側のアニメーションを CSS だけで付けられない
const FaqItem = ({ q, a, defaultOpen }: { q: string; a: ReactNode; defaultOpen: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  return (
    <div className={styles.faqItem}>
      <button
        aria-controls={panelId}
        aria-expanded={open}
        className={styles.question}
        type="button"
        onClick={() => {
          setOpen((o) => !o);
        }}
      >
        {q}
        <Chevron className={styles.chevron} size={18} />
      </button>
      <div className={styles.panel} id={panelId} inert={!open}>
        <div className={styles.panelInner}>
          <p className={styles.answer}>{a}</p>
        </div>
      </div>
    </div>
  );
};

export const About = () => (
  <section aria-labelledby="about" className={styles.about}>
    <div className={styles.aboutIntro}>
      <h2 className={styles.aboutHeading} id="about">
        ゆるい説明
      </h2>
      <p className={styles.lead}>どんな記事を入れているかと、気になりそうなことを書いています。</p>
    </div>
    <div className={styles.block}>
      <h3 className={styles.blockHeading}>カテゴリ</h3>
      <ul className={styles.categories}>
        {category.options.map((c) => {
          const { Icon, text } = categoryDetails[c];
          return (
            <AnimateIcon key={c} animateOnHover asChild>
              <li className={styles.category}>
                <span className={styles.categoryName}>
                  <Icon className={styles.categoryIcon} size={18} />
                  {c}
                </span>
                {text}
              </li>
            </AnimateIcon>
          );
        })}
      </ul>
    </div>
    <div className={styles.block}>
      <h3 className={styles.blockHeading}>気になりそうなこと</h3>
      <div className={styles.faq}>
        {faqs.map(({ q, a }, i) => (
          <FaqItem key={q} a={a} defaultOpen={i === 0} q={q} />
        ))}
      </div>
    </div>
  </section>
);
