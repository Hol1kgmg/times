import { useState } from "react";

export const ClientPage = () => {
  const [n, setN] = useState(0);
  return (
    <main>
      <h1>Client only</h1>
      <button
        type="button"
        onClick={() => {
          setN(n + 1);
        }}
      >
        count: {n}
      </button>
    </main>
  );
};
