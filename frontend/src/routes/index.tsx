import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { listItems } from "#/server/items";

// 検索パラメータを検証 (?q=...)、loader でサーバー関数を呼ぶ。SSR は既定の true。
export const Route = createFileRoute("/")({
  validateSearch: z.object({ q: z.string().default("") }),
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: ({ deps }) => listItems({ data: deps }),
  component: Home,
});

function Home() {
  const items = Route.useLoaderData();
  const { q } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <main>
      <h1>Items</h1>
      <input
        value={q}
        placeholder="filter"
        onChange={(e) => navigate({ search: { q: e.target.value }, replace: true })}
      />
      <ul>
        {items.map((i) => (
          <li key={i.id}>
            <Link to="/items/$id" params={{ id: i.id }}>
              {i.title}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
