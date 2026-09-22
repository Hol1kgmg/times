import { getRouteApi, Link } from "@tanstack/react-router";

// getRouteApi でルート定義 (app 層) を import せずに loader/search の型を得る
const route = getRouteApi("/");

export const HomePage = () => {
  const items = route.useLoaderData();
  const { q } = route.useSearch();
  const navigate = route.useNavigate();
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
