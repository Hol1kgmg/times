CREATE TABLE items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL CHECK (title <> ''),
    created_at timestamptz NOT NULL DEFAULT now()
);
