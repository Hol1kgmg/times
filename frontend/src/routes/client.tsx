import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

// ssr: false = サーバーでは何も描画せず、クライアントでのみマウントする
export const Route = createFileRoute("/client")({
  ssr: false,
  component: () => {
    const [n, setN] = useState(0);
    return (
      <main>
        <h1>Client only</h1>
        <button onClick={() => setN(n + 1)}>count: {n}</button>
      </main>
    );
  },
});
