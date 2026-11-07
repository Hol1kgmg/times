import { AnimateIcon } from "@animate-ui/react/icons";
import type { ReactNode } from "react";
import { Button, Disclosure, DisclosurePanel } from "react-aria-components";
// バレルは server function も再エクスポートしていて、Storybook で Start のサーバー実装まで引き込むため
import { category } from "#/shared/api/schemas";
import type { Category } from "#/shared/api";
import { FEED_PATH } from "#/shared/config/site";
import { useHovered } from "#/shared/lib/use-hovered";
import { Flame } from "#/shared/ui/icons/flame";
import styles from "./about.module.css";
import { Chevron } from "#/shared/ui/chevron";
import { categoryIcons } from "#/shared/ui/category-icons";
import { HotBubble } from "#/shared/ui/icons/hot-bubble";

const categoryTexts = {
  セキュリティ: "注意喚起とか脆弱性の話",
  IT系: "設計や開発まわりの記事・スライド",
  UI系: "デザインやフロントエンドの表現",
  AI系: "AI とかエージェントまわり",
  "面白そうなツール・サービス": "ちょっと触ってみたいもの",
  その他: "どれにも入らなかったもの",
} satisfies Record<Category, string>;

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
    a: (
      <>
        決まってません。気になる記事がたまったら投稿してます。投稿したら <a href={FEED_PATH}>RSS</a>{" "}
        でお知らせします (記事の一覧は入らず、公開したことだけ届きます)。
      </>
    ),
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
const FaqItem = ({ q, a, defaultOpen }: { q: string; a: ReactNode; defaultOpen: boolean }) => (
  <Disclosure className={styles.faqItem} defaultExpanded={defaultOpen}>
    <Button className={styles.question} slot="trigger">
      {q}
      <Chevron className={styles.chevron} size={18} />
    </Button>
    <DisclosurePanel className={styles.panel}>
      <p className={styles.answer}>{a}</p>
    </DisclosurePanel>
  </Disclosure>
);

// <li> は呼び出し側に置く。markuplint はコンポーネントの中を追わず、<ul> 直下を不正と判定する
const CategoryItem = ({ c }: { c: Category }) => {
  const Icon = categoryIcons[c];
  return (
    <AnimateIcon animateOnHover asChild>
      <div className={styles.category} {...useHovered()}>
        <span className={styles.categoryName}>
          <Icon className={styles.categoryIcon} role="none" size={18} />
          {c}
        </span>
        {categoryTexts[c]}
      </div>
    </AnimateIcon>
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
        {category.options.map((c) => (
          <li key={c}>
            <CategoryItem c={c} />
          </li>
        ))}
      </ul>
    </div>
    <div className={styles.block}>
      <h3 className={styles.blockHeading}>ホットトピック</h3>
      <AnimateIcon animateOnHover asChild>
        <div className={styles.hot}>
          <span className={styles.hotMark}>
            <Flame role="none" size={18} />
            <HotBubble animate={false} size={18} />
          </span>
          <p className={styles.hotText}>個人的にホットな話題の記事には炎を付けてます。</p>
        </div>
      </AnimateIcon>
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
