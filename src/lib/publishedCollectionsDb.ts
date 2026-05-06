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
  sourceJazzId: string;
  jazzPublishedId: string | null;
  ownerClerkId: string;
  slug: string;
  name: string;
  description: string | null;
  layout: 'minimal' | 'feature';
  allowCloning: boolean;
  publishedAt: Date;
  updatedAt: Date;
  topLevelProducts: PublishedProduct[];
  slots: PublishedSlot[];
};

export type UpsertPublishedCollectionInput = {
  sourceJazzId: string;
  jazzPublishedId?: string;
  ownerClerkId: string;
  slug: string;
  name: string;
  description?: string;
  layout: string;
  allowCloning: boolean;
  topLevelProducts: Omit<PublishedProduct, 'id'>[];
  slots: (Omit<PublishedSlot, 'id' | 'products'> & {
    products: Omit<PublishedProduct, 'id'>[];
  })[];
};

export async function upsertPublishedCollection(
  input: UpsertPublishedCollectionInput,
): Promise<string> {
  const [row] = await sql`
    INSERT INTO published_collections (
      source_jazz_id, jazz_published_id, owner_clerk_id, slug, name,
      description, layout, allow_cloning, updated_at
    ) VALUES (
      ${input.sourceJazzId}, ${input.jazzPublishedId ?? null},
      ${input.ownerClerkId}, ${input.slug}, ${input.name},
      ${input.description ?? null}, ${input.layout}, ${input.allowCloning}, now()
    )
    ON CONFLICT (source_jazz_id) DO UPDATE SET
      jazz_published_id = EXCLUDED.jazz_published_id,
      owner_clerk_id    = EXCLUDED.owner_clerk_id,
      slug              = EXCLUDED.slug,
      name              = EXCLUDED.name,
      description       = EXCLUDED.description,
      layout            = EXCLUDED.layout,
      allow_cloning     = EXCLUDED.allow_cloning,
      updated_at        = now()
    RETURNING id
  `;

  const collectionId = row.id as string;

  await sql`DELETE FROM published_blocks WHERE collection_id = ${collectionId}`;

  for (const product of input.topLevelProducts) {
    await sql`
      INSERT INTO published_blocks (
        collection_id, type, sort_order,
        title, url, description, price, image_url, brand, merchant
      ) VALUES (
        ${collectionId}, 'product', ${product.sortOrder},
        ${product.title ?? null}, ${product.url ?? null},
        ${product.description ?? null}, ${product.price ?? null},
        ${product.imageUrl ?? null}, ${product.brand ?? null},
        ${product.merchant ?? null}
      )
    `;
  }

  for (const slot of input.slots) {
    const [slotRow] = await sql`
      INSERT INTO published_blocks (
        collection_id, type, sort_order, slot_name, slot_description
      ) VALUES (
        ${collectionId}, 'slot', ${slot.sortOrder},
        ${slot.slotName ?? null}, ${slot.slotDescription ?? null}
      )
      RETURNING id
    `;

    const slotId = slotRow.id as string;

    for (const product of slot.products) {
      await sql`
        INSERT INTO published_blocks (
          collection_id, parent_block_id, type, sort_order,
          title, url, description, price, image_url, brand, merchant
        ) VALUES (
          ${collectionId}, ${slotId}, 'product', ${product.sortOrder},
          ${product.title ?? null}, ${product.url ?? null},
          ${product.description ?? null}, ${product.price ?? null},
          ${product.imageUrl ?? null}, ${product.brand ?? null},
          ${product.merchant ?? null}
        )
      `;
    }
  }

  return collectionId;
}

export async function deletePublishedCollection(
  sourceJazzId: string,
): Promise<void> {
  await sql`DELETE FROM published_collections WHERE source_jazz_id = ${sourceJazzId}`;
}

export async function getPublishedCollectionByOwnerAndSlug(
  ownerClerkId: string,
  slug: string,
): Promise<PublishedCollection | null> {
  const rows = await sql`
    SELECT id, source_jazz_id, jazz_published_id, owner_clerk_id, slug, name,
           description, layout, allow_cloning, published_at, updated_at
    FROM published_collections
    WHERE owner_clerk_id = ${ownerClerkId} AND slug = ${slug}
  `;
  if (!rows[0]) return null;
  return loadCollectionWithBlocks(rows[0]);
}

export type PublishedCollectionSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  layout: 'minimal' | 'feature';
  itemCount: number;
  publishedAt: Date;
};

export async function getPublishedCollectionsByOwner(
  ownerClerkId: string,
): Promise<PublishedCollectionSummary[]> {
  const rows = await sql`
    SELECT pc.id, pc.slug, pc.name, pc.description, pc.layout, pc.published_at,
           COUNT(pb.id) FILTER (WHERE pb.type = 'product') AS item_count
    FROM published_collections pc
    LEFT JOIN published_blocks pb ON pb.collection_id = pc.id
    WHERE pc.owner_clerk_id = ${ownerClerkId}
    GROUP BY pc.id
    ORDER BY pc.published_at DESC
  `;
  return rows.map((r) => ({
    id: r.id as string,
    slug: r.slug as string,
    name: r.name as string,
    description: r.description as string | null,
    layout: r.layout as 'minimal' | 'feature',
    itemCount: Number(r.item_count),
    publishedAt: r.published_at as Date,
  }));
}

export async function getPublishedCollectionById(
  id: string,
): Promise<PublishedCollection | null> {
  const rows = await sql`
    SELECT id, source_jazz_id, jazz_published_id, owner_clerk_id, slug, name,
           description, layout, allow_cloning, published_at, updated_at
    FROM published_collections
    WHERE id = ${id}::uuid
       OR jazz_published_id = ${id}
  `;
  if (!rows[0]) return null;
  return loadCollectionWithBlocks(rows[0]);
}

async function loadCollectionWithBlocks(
  row: Record<string, unknown>,
): Promise<PublishedCollection> {
  const blocks = await sql`
    SELECT id, parent_block_id, type, sort_order,
           slot_name, slot_description,
           title, url, description, price, image_url, brand, merchant
    FROM published_blocks
    WHERE collection_id = ${row.id as string}
    ORDER BY sort_order ASC
  `;

  const slotMap = new Map<string, PublishedSlot>();
  const slots: PublishedSlot[] = [];
  const topLevelProducts: PublishedProduct[] = [];

  for (const b of blocks) {
    if (b.type === 'slot') {
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
    if (b.type !== 'product') continue;
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
    sourceJazzId: row.source_jazz_id as string,
    jazzPublishedId: row.jazz_published_id as string | null,
    ownerClerkId: row.owner_clerk_id as string,
    slug: row.slug as string,
    name: row.name as string,
    description: row.description as string | null,
    layout: row.layout as 'minimal' | 'feature',
    allowCloning: row.allow_cloning as boolean,
    publishedAt: row.published_at as Date,
    updatedAt: row.updated_at as Date,
    topLevelProducts,
    slots,
  };
}
