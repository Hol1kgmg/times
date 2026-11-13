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
import { Archive } from "#/shared/ui/icons/archive";
import { BrandIcon } from "#/shared/ui/icons/brand";
import type { Brand } from "#/shared/ui/icons/brand";
import { ChartLine } from "#/shared/ui/icons/chart-line";
import { Cog } from "#/shared/ui/icons/cog";
import { Globe } from "#/shared/ui/icons/globe";
import { HotBubble } from "#/shared/ui/icons/hot-bubble";
import { LineIcon } from "#/shared/ui/icons/line-icon";
import { Sparkles } from "#/shared/ui/icons/sparkles";
import { Translate } from "#/shared/ui/icons/translate";
import { Zap } from "#/shared/ui/icons/zap";

const categoryTexts = {
  セキュリティ: "注意喚起とか脆弱性の話",
  IT系: "設計や開発まわりの記事・スライド",
  UI系: "デザインやフロントエンドの表現",
  AI系: "AI とかエージェントまわり",
  "面白そうなツール・サービス": "ちょっと触ってみたいもの",
  その他: "どれにも入らなかったもの",
} satisfies Record<Category, string>;

const arrowIcon = "M5 12h14M13 6l6 6-6 6";

const Node = ({ className, icon, name }: { className?: string; icon: ReactNode; name: string }) => (
  <div className={`${styles.node} ${className ?? ""}`}>
    {icon}
    {name}
  </div>
);

const Group = ({
  children,
  className,
  label,
  stack,
}: {
  children: ReactNode;
  className: string;
  label: string;
  stack?: [Brand, string][];
}) => (
  <div className={`${styles.group} ${className}`}>
    <span className={styles.groupLabel}>{label}</span>
    <div className={styles.services}>{children}</div>
    {stack && (
      <ul className={styles.stack}>
        {stack.map(([brand, name]) => (
          <li key={name}>
            <BrandIcon brand={brand} size={14} />
            {name}
          </li>
        ))}
      </ul>
    )}
  </div>
);

const Arrow = ({ className }: { className: string }) => (
  <span className={`${styles.arrow} ${className}`}>
    <LineIcon d={arrowIcon} size={18} />
  </span>
);

// 構成が変わったら docs/tech-stack.md と FAQ の文章もあわせて直す
const Architecture = () => (
  <div aria-hidden="true" className={styles.architecture}>
    <Node className={styles.browser} icon={<Globe size={18} />} name="ブラウザ" />
    <Arrow className={styles.toFrontend} />
    <Group
      className={styles.frontend}
      label="フロントエンド"
      stack={[
        ["React", "React"],
        ["TanStack", "TanStack Start"],
      ]}
    >
      <Node icon={<Zap size={18} />} name="Cloudflare Workers" />
    </Group>
    <Arrow className={styles.toBackend} />
    <Group
      className={styles.backend}
      label="バックエンド"
      stack={[
        ["Go", "Go"],
        ["Gin", "Gin"],
        ["PostgreSQL", "PostgreSQL"],
      ]}
    >
      <Node icon={<Cog size={18} />} name="Cloud Run" />
      <Arrow className={styles.toSql} />
      <Node icon={<Archive size={18} />} name="Cloud SQL" />
    </Group>
    <Arrow className={styles.toExternal} />
    <Group className={styles.external} label="外部サービス">
      <Node icon={<Sparkles size={18} />} name="Workers AI" />
      <Node icon={<Translate size={18} />} name="Cloud Translation" />
      <Node icon={<ChartLine size={18} />} name="GA4" />
    </Group>
  </div>
);

const faqs: { q: string; a: ReactNode; figure?: ReactNode }[] = [
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
    q: "何か記録してる？",
    a: (
      <>
        Google
        アナリティクスで、ページが見られた数と記事が押された数を数えてます。同じブラウザを見分けるために、ランダムな
        ID をブラウザに保存してます
        (名前やログインとは結び付けてません)。ブラウザの設定でこのサイトのデータを消すと、ID
        も消えます。詳しくは <a href="/privacy">プライバシーポリシー</a> に書いてます。
      </>
    ),
  },
  {
    q: "どうやって作ってる？",
    a: "画面は Cloudflare Workers から出してて、記事のデータは Google Cloud (Cloud Run と Cloud SQL) に置いてます。カテゴリの振り分けは Workers AI、タイトルの翻訳は Google の Cloud Translation に任せてます。閲覧の数は Workers から Google アナリティクス (GA4) に送ってます。作りは TanStack Start (React) と Go です。",
    figure: <Architecture />,
  },
  {
    q: "誰がやってる？",
    a: (
      <>
        Hol1kgmg がひとりでやってます (
        <a href="https://github.com/Hol1kgmg" rel="noopener noreferrer" target="_blank">
          GitHub
        </a>
        )。連絡は <a href="/contact">お問い合わせ</a> から。
      </>
    ),
  },
];

// <details> は閉じると中身が描画されず、閉じる側のアニメーションを CSS だけで付けられない
const FaqItem = ({
  q,
  a,
  figure,
  defaultOpen,
}: {
  q: string;
  a: ReactNode;
  figure?: ReactNode;
  defaultOpen: boolean;
}) => (
  <Disclosure className={styles.faqItem} defaultExpanded={defaultOpen}>
    <Button className={styles.question} slot="trigger">
      {q}
      <Chevron className={styles.chevron} size={18} />
    </Button>
    <DisclosurePanel className={styles.panel}>
      <p className={styles.answer}>{a}</p>
      {figure}
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
        {faqs.map(({ q, a, figure }, i) => (
          <FaqItem key={q} a={a} defaultOpen={i === 0} figure={figure} q={q} />
        ))}
      </div>
    </div>
  </section>
);
