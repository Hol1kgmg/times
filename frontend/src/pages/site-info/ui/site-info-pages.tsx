import type { ReactNode } from "react";
import { Link } from "react-aria-components";
// バレルは server function も再エクスポートしていて、Storybook で Start のサーバー実装まで引き込むため
import { category } from "#/shared/api/schemas";
import { AUTHOR_URL, FEED_PATH, SITE_NAME, SITE_URL } from "#/shared/config/site";
import { RouterLink } from "#/shared/ui/router-link";
import styles from "./site-info-page.module.css";

const SITE_INFO = {
  about: {
    title: "このサイトについて",
    description: "z-times.dev が何を載せてて、どのくらい更新してて、誰がどう作ってるかの説明です。",
  },
  contact: {
    title: "お問い合わせ",
    description: "z-times.dev への連絡のしかたと、載せた記事を外してほしいときの頼み方です。",
  },
  privacy: {
    title: "プライバシーポリシー",
    description:
      "z-times.dev が計測で集めてる情報、ブラウザに保存するもの、ほかのサービスへ渡るものです。",
  },
};

export const siteInfoHead = (page: keyof typeof SITE_INFO) => {
  const { title, description } = SITE_INFO[page];
  const url = `${SITE_URL}/${page}`;
  return {
    meta: [
      { title: `${title} | ${SITE_NAME}` },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
    ],
    links: [{ rel: "canonical", href: url }],
  };
};

const Page = ({ title, children }: { title: string; children: ReactNode }) => (
  <article className={styles.page}>
    <h1 className={styles.heading}>{title}</h1>
    {children}
  </article>
);

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className={styles.section}>
    <h2 className={styles.sectionHeading}>{title}</h2>
    {children}
  </section>
);

const P = ({ children }: { children: ReactNode }) => <p className={styles.body}>{children}</p>;

const GitHub = ({ children }: { children: ReactNode }) => (
  <Link className={styles.link} href={AUTHOR_URL} rel="noopener noreferrer" target="_blank">
    {children}
  </Link>
);

const Contact = () => (
  <RouterLink className={styles.link} to="/contact">
    お問い合わせ
  </RouterLink>
);

export const AboutPage = () => (
  <Page title={SITE_INFO.about.title}>
    <P>
      z-times.dev (ロゴでは z_times.dev)
      は、見かけて気になった技術や趣味の記事を、日ごとにゆるくまとめてる個人サイトです。ニュースサイトや会社の公式サイトではなく、ひとりで読んだものを残しておく場所として続けてます。
    </P>
    <Section title="何を載せてる？">
      <P>
        記事のリンクを日付ごとの Digest にまとめて、{category.options.join("・")}の{" "}
        {category.options.length}{" "}
        つのカテゴリに分けて並べてます。個人的にホットな話題の記事には炎を付けてます。載せてるのはタイトルとリンクだけで、記事の中身は写してません。続きは元のページで読んでください。
      </P>
    </Section>
    <Section title="どのくらい更新してる？">
      <P>
        決まってません。気になる記事がたまったら投稿してます。
        <RouterLink className={styles.link} to="/">
          トップ
        </RouterLink>
        にはいちばん新しい 1 日分を出してて、公開したことは{" "}
        <Link className={styles.link} href={FEED_PATH}>
          RSS
        </Link>{" "}
        でお知らせしてます。
      </P>
    </Section>
    <Section title="どうやって作ってる？">
      <P>
        画面は Cloudflare Workers から出してて、記事のデータは Google Cloud (Cloud Run と Cloud SQL)
        に置いてます。カテゴリの振り分けは Workers AI、タイトルの翻訳は Google の Cloud Translation
        に任せてます。作りは TanStack Start (React) と Go です。
      </P>
    </Section>
    <Section title="誰がやってる？">
      <P>
        Hol1kgmg がひとりでやってます (<GitHub>GitHub</GitHub>
        )。載せた記事のことやサイトの不具合は、
        <Contact /> に書いた方法で知らせてもらえると助かります。
      </P>
    </Section>
  </Page>
);

export const ContactPage = () => (
  <Page title={SITE_INFO.contact.title}>
    <P>
      z-times.dev は Hol1kgmg
      がひとりでやってる個人サイトです。窓口の会社や担当者はいないので、連絡はすべて本人に届きます。
    </P>
    <Section title="連絡のしかた">
      <P>
        Hol1kgmg の <GitHub>GitHub のプロフィール</GitHub>
        にある連絡先からお願いします。メールアドレスや電話番号はこのサイトには載せてません。
      </P>
    </Section>
    <Section title="こんなときに連絡してください">
      <ul className={styles.list}>
        <li>載せた記事のリンクが切れている、タイトルが間違っている</li>
        <li>自分の記事を載せないでほしい、外してほしい (確かめたら外します)</li>
        <li>サイトの表示や動きがおかしい (ブラウザの種類と画面の幅を書いてもらえると助かります)</li>
        <li>
          <RouterLink className={styles.link} to="/privacy">
            プライバシーポリシー
          </RouterLink>
          に書いた計測について聞きたいことがある
        </li>
      </ul>
    </Section>
    <Section title="記事を外してほしいとき">
      <P>
        外してほしい記事の URL と、書いた人や運営している人だと分かるもの
        (記事のページやプロフィールへのリンクなど) を添えてください。確かめられたら、その記事を
        Digest から外します。RSS
        にはもともと記事の一覧を入れていないので、外したあとはトップにも過去の Digest
        にも出なくなります。
      </P>
    </Section>
    <Section title="返事について">
      <P>
        ひとりでやってるので、返事には時間がかかることがあります。記事の内容そのものについての質問は、元の記事を書いた人に聞いてください。このサイトでは記事の中身を書いておらず、答えられないためです。
      </P>
    </Section>
  </Page>
);

export const PrivacyPage = () => (
  <Page title={SITE_INFO.privacy.title}>
    <P>
      z-times.dev
      で集めている情報と、その使い方です。名前やメールアドレスなど、人を特定する情報を入力してもらう場所はありません。
    </P>
    <Section title="アクセスの計測">
      <P>
        Google アナリティクス 4
        で、ページが見られた数と記事が押された数を数えてます。送るのは、見たページの URL
        (クエリは除きます) とタイトル、押した記事の URL と Digest の日付、端末の種類
        (PC・スマホ・タブレット)、地域を出すための IP アドレスです。ブラウザから Google
        に直接は送らず、このサイトのサーバー (Cloudflare Workers) から送ってます。クローラーなど bot
        と分かるアクセスは送りません。
      </P>
    </Section>
    <Section title="ブラウザに保存するもの">
      <P>
        同じブラウザを見分けるために、ランダムな ID をブラウザ (localStorage)
        に保存してます。ログインやほかの情報とは結び付けてません。ブラウザの設定でこのサイトのデータを消すと、ID
        も消えます。保存を止めたブラウザでは、ページを開いている間だけ使います。Cookie
        は管理者のログインにだけ使ってて、見るだけの人には付けません。
      </P>
    </Section>
    <Section title="ほかのサービスへ渡るもの">
      <ul className={styles.list}>
        <li>
          記事の行頭のアイコンは Google の favicon
          の配信から読み込むので、ブラウザから記事のドメインが Google に送られます。
        </li>
        <li>
          記事にカーソルを合わせたときのプレビューの画像は、記事のサイトから直接読み込みます。
        </li>
        <li>
          AI のアイコンから AI サービスを選ぶと、そのサービスが開き、記事のタイトルと URL
          を含む頼み方の文がそのサービスに渡ります。
        </li>
      </ul>
    </Section>
    <Section title="このページの変更">
      <P>
        集めるものを変えたら、このページを書き直します。聞きたいことがあれば <Contact />{" "}
        からどうぞ。
      </P>
    </Section>
    <p className={styles.meta}>最終更新: 2026年11月13日</p>
  </Page>
);
