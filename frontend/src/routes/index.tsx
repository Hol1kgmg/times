import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { listItems } from "#/server/items";

const Home = () => {
  const items = Route.useLoaderData();
  const { q } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <main>
      <h1>Items</h1>
      <input
        placeholder="filter"
        value={q}
        onChange={(e) => {
          void navigate({ search: { q: e.target.value }, replace: true });
        }}
      />
      <ul>
        {items.map((i) => (
          <li key={i.id}>
            <Link params={{ id: i.id }} to="/items/$id">
              {i.title}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
};

// 検索パラメータを検証 (?q=...)、loader でサーバー関数を呼ぶ。SSR は既定の true。
export const Route = createFileRoute("/")({
  validateSearch: z.object({ q: z.string().default("") }),
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: async ({ deps }) => await listItems({ data: deps }),
  component: Home,
});
