import { sql } from './db';

export type PublishedProduct = {
  id: string;
  title: string | null;
  url: string | null;
  description: string | null;
  price: string | null;
  imageUrl: string | null;
  brand: string | null;
  merchant: string | null;
  sortOrder: number;
};

export type PublishedSlot = {
  id: string;
  slotName: string | null;
  slotDescription: string | null;
  sortOrder: number;
  products: PublishedProduct[];
};

export type PublishedCollection = {
  id: string;
  sourceJazzId: string | null;
  sourceCollectionId: string | null;
  sourceVersion: number | null;
  jazzPublishedId: string | null;
  ownerClerkId: string;
  slug: string;
  name: string;
  description: string | null;
  color: string | null;
  layout: 'minimal' | 'feature';
  allowCloning: boolean;
  publishedAt: Date;
  updatedAt: Date;
  topLevelProducts: PublishedProduct[];
  slots: PublishedSlot[];
};

export async function getAllPublishedCollectionSlugs(): Promise<
  { username: string; slug: string; updatedAt: Date }[]
> {
  const rows = await sql`
    SELECT username, slug, updated_at
    FROM published_collections
    WHERE username IS NOT NULL
    ORDER BY updated_at DESC
  `;
  return rows.map((r) => ({
    username: r.username as string,
    slug: r.slug as string,
    updatedAt: r.updated_at as Date,
  }));
}

export async function getPublishedCollectionByOwnerAndSlug(
  ownerClerkId: string,
  slug: string,
): Promise<PublishedCollection | null> {
  const rows = await sql`
    SELECT id, source_jazz_id, jazz_published_id, owner_clerk_id, slug, name,
           source_collection_id, source_version,
           description, color, layout, allow_cloning, published_at, updated_at
    FROM published_collections
    WHERE owner_clerk_id = ${ownerClerkId} AND slug = ${slug}
  `;
  if (!rows[0]) return null;
  return loadCollectionWithBlocks(rows[0]);
}

export type CoverImage = { url: string; title: string | null };

export type PublishedCollectionSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  color: string | null;
  layout: 'minimal' | 'feature';
  itemCount: number;
  coverImages: CoverImage[];
  publishedAt: Date;
};

export async function getPublishedCollectionsByOwner(
  ownerClerkId: string,
): Promise<PublishedCollectionSummary[]> {
  const rows = await sql`
    SELECT
      pc.id, pc.slug, pc.name, pc.description, pc.color, pc.layout, pc.published_at,
      (
        SELECT COUNT(*) FROM published_blocks
        WHERE collection_id = pc.id AND type = 'product'
      ) AS item_count,
      (
        SELECT COALESCE(json_agg(json_build_object('url', image_url, 'title', title)), '[]'::json)
        FROM (
          SELECT image_url, title FROM published_blocks
          WHERE collection_id = pc.id
            AND type = 'product'
            AND image_url IS NOT NULL
          ORDER BY sort_order
          LIMIT 3
        ) imgs
      ) AS cover_images
    FROM published_collections pc
    WHERE pc.owner_clerk_id = ${ownerClerkId}
    ORDER BY pc.published_at DESC
  `;
  return rows.map((r) => ({
    id: r.id as string,
    slug: r.slug as string,
    name: r.name as string,
    description: r.description as string | null,
    color: r.color as string | null,
    layout: r.layout as 'minimal' | 'feature',
    itemCount: Number(r.item_count),
    coverImages: (r.cover_images as CoverImage[]) ?? [],
    publishedAt: r.published_at as Date,
  }));
}

export async function getPublishedCollectionById(
  id: string,
): Promise<PublishedCollection | null> {
  const rows = await sql`
    SELECT id, source_jazz_id, jazz_published_id, owner_clerk_id, slug, name,
           source_collection_id, source_version,
           description, color, layout, allow_cloning, published_at, updated_at
    FROM published_collections
    WHERE id = ${id}::uuid
       OR jazz_published_id = ${id}
  `;
  if (!rows[0]) return null;
  return loadCollectionWithBlocks(rows[0]);
}

export async function getPublishedCollectionSummariesByUsernameAndSlugs(
  entries: { username: string; slug: string }[],
): Promise<
  (PublishedCollectionSummary & { username: string; slug: string })[]
> {
  if (entries.length === 0) return [];

  const results = await Promise.all(
    entries.map(async ({ username, slug }) => {
      const rows = await sql`
        SELECT
          pc.id, pc.username, pc.slug, pc.name, pc.description, pc.color, pc.layout, pc.published_at,
          (
            SELECT COUNT(*) FROM published_blocks
            WHERE collection_id = pc.id AND type = 'product'
          ) AS item_count,
          (
            SELECT COALESCE(json_agg(json_build_object('url', pb.image_url, 'title', pb.title)), '[]'::json)
            FROM (
              SELECT pb.image_url, pb.title
              FROM published_blocks pb
              WHERE pb.collection_id = pc.id
                AND pb.type = 'product'
                AND pb.image_url IS NOT NULL
              ORDER BY pb.sort_order ASC
              LIMIT 3
            ) imgs
          ) AS cover_images
        FROM published_collections pc
        WHERE pc.username = ${username} AND pc.slug = ${slug}
      `;
      if (!rows[0]) return null;
      const r = rows[0];
      return {
        id: r.id as string,
        username: r.username as string,
        slug: r.slug as string,
        name: r.name as string,
        description: r.description as string | null,
        color: r.color as string | null,
        layout: r.layout as 'minimal' | 'feature',
        itemCount: Number(r.item_count),
        coverImages: (r.cover_images as CoverImage[]) ?? [],
        publishedAt: r.published_at as Date,
      };
    }),
  );

  return results.filter(
    (r): r is PublishedCollectionSummary & { username: string; slug: string } =>
      r !== null,
  );
}

async function loadCollectionWithBlocks(
  row: Record<string, unknown>,
): Promise<PublishedCollection> {
  const blocks = await sql`
    SELECT id, parent_block_id, type, sort_order,
           slot_name, slot_description,
           title, url, description, price, image_url, brand, merchant, properties
    FROM published_blocks
    WHERE collection_id = ${row.id as string}
    ORDER BY sort_order ASC
  `;

  const slotMap = new Map<string, PublishedSlot>();
  const slots: PublishedSlot[] = [];
  const topLevelProducts: PublishedProduct[] = [];

  for (const b of blocks) {
    if (b.type === 'slot' || b.type === 'section') {
      const slot: PublishedSlot = {
        id: b.id as string,
        slotName: b.slot_name as string | null,
        slotDescription: b.slot_description as string | null,
        sortOrder: b.sort_order as number,
        products: [],
      };
      slotMap.set(b.id as string, slot);
      slots.push(slot);
    }
  }

  for (const b of blocks) {
    if (b.type === 'slot' || b.type === 'section') continue;
    const product: PublishedProduct = {
      id: b.id as string,
      title: b.title as string | null,
      url: b.url as string | null,
      description: b.description as string | null,
      price: b.price as string | null,
      imageUrl: b.image_url as string | null,
      brand: b.brand as string | null,
      merchant: b.merchant as string | null,
      sortOrder: b.sort_order as number,
    };

    if (b.parent_block_id) {
      slotMap.get(b.parent_block_id as string)?.products.push(product);
    } else {
      topLevelProducts.push(product);
    }
  }

  return {
    id: row.id as string,
    sourceJazzId: row.source_jazz_id as string | null,
    sourceCollectionId: row.source_collection_id as string | null,
    sourceVersion:
      row.source_version === null || row.source_version === undefined
        ? null
        : Number(row.source_version),
    jazzPublishedId: row.jazz_published_id as string | null,
    ownerClerkId: row.owner_clerk_id as string,
    slug: row.slug as string,
    name: row.name as string,
    description: row.description as string | null,
    color: row.color as string | null,
    layout: row.layout as 'minimal' | 'feature',
    allowCloning: row.allow_cloning as boolean,
    publishedAt: row.published_at as Date,
    updatedAt: row.updated_at as Date,
    topLevelProducts,
    slots,
  };
}
