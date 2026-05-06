CREATE TABLE published_collections (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_jazz_id    TEXT        UNIQUE NOT NULL,
  jazz_published_id TEXT,
  owner_clerk_id    TEXT        NOT NULL,
  slug              TEXT        NOT NULL,
  name              TEXT        NOT NULL,
  description       TEXT,
  layout            TEXT        NOT NULL DEFAULT 'minimal',
  allow_cloning     BOOLEAN     NOT NULL DEFAULT true,
  published_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_clerk_id, slug)
);

CREATE INDEX ON published_collections (owner_clerk_id);
CREATE INDEX ON published_collections (slug);

CREATE TABLE published_blocks (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id    UUID        NOT NULL REFERENCES published_collections(id) ON DELETE CASCADE,
  parent_block_id  UUID        REFERENCES published_blocks(id) ON DELETE CASCADE,
  type             TEXT        NOT NULL CHECK (type IN ('slot', 'product')),
  sort_order       INT         NOT NULL DEFAULT 0,
  -- slot columns
  slot_name        TEXT,
  slot_description TEXT,
  -- product columns
  url              TEXT,
  title            TEXT,
  description      TEXT,
  price            TEXT,
  image_url        TEXT,
  brand            TEXT,
  merchant         TEXT,
  -- overflow for future fields
  properties       JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON published_blocks (collection_id);
CREATE INDEX ON published_blocks (parent_block_id);
