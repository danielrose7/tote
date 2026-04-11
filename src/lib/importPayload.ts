import { Group } from 'jazz-tools';
import { Block, BlockList, JazzAccount } from '../schema';

export interface ImportItem {
  title: string;
  sourceUrl: string;
  merchant?: string;
  imageUrl?: string;
  price?: string | null;
  currency?: string;
  description?: string;
  note?: string;
  sourceRowId?: string;
  confidence?: number;
}

export interface ImportSection {
  title: string;
  description?: string;
  items: ImportItem[];
}

export interface ImportPayload {
  title: string;
  intro?: string;
  tags?: string[];
  sections: ImportSection[];
  warnings?: string[];
  sourceMetadata?: {
    sourceType?: string;
    importedAt?: string;
    workspaceVersion?: number;
  };
}

export function validatePayload(json: unknown): ImportPayload {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    throw new Error('Invalid JSON: expected an object');
  }
  const obj = json as Record<string, unknown>;
  if (typeof obj.title !== 'string' || !obj.title.trim()) {
    throw new Error('Missing required field: title');
  }
  if (!Array.isArray(obj.sections) || obj.sections.length === 0) {
    throw new Error(
      'Missing required field: sections (must be a non-empty array)',
    );
  }
  for (const section of obj.sections) {
    if (!section || typeof section !== 'object')
      throw new Error('Invalid section');
    const s = section as Record<string, unknown>;
    if (typeof s.title !== 'string' || !s.title.trim()) {
      throw new Error('Each section must have a title');
    }
    if (!Array.isArray(s.items))
      throw new Error(`Section "${s.title}" is missing items array`);
    for (const item of s.items) {
      if (!item || typeof item !== 'object') throw new Error('Invalid item');
      const i = item as Record<string, unknown>;
      if (!i.title && !i.sourceUrl) {
        throw new Error('Each item must have at least a title or sourceUrl');
      }
    }
  }
  return obj as ImportPayload;
}

export function createCollectionFromPayload(
  payload: ImportPayload,
  me: InstanceType<typeof JazzAccount>,
): InstanceType<typeof Block> {
  const ownerGroup = Group.create({ owner: me });
  ownerGroup.addMember(me, 'admin');

  const sectionBlocks: InstanceType<typeof Block>[] = [];
  for (const section of payload.sections) {
    const productBlocks = section.items.map((item) =>
      Block.create(
        {
          type: 'product',
          name: item.title || item.sourceUrl || 'Untitled',
          productData: {
            url: item.sourceUrl || '',
            imageUrl: item.imageUrl,
            price: item.price ?? undefined,
            description: item.description,
            notes: item.note,
          },
          createdAt: new Date(),
        },
        { owner: ownerGroup },
      ),
    );
    const slotChildren = BlockList.create(productBlocks, { owner: ownerGroup });
    sectionBlocks.push(
      Block.create(
        {
          type: 'slot',
          name: section.title,
          slotData: {},
          children: slotChildren,
          createdAt: new Date(),
        },
        { owner: ownerGroup },
      ),
    );
  }

  const collectionChildren = BlockList.create(sectionBlocks, {
    owner: ownerGroup,
  });
  return Block.create(
    {
      type: 'collection',
      name: payload.title,
      collectionData: {
        description: payload.intro,
        color: '#6366f1',
        viewMode: 'grid',
        publicLayout: 'minimal',
        allowCloning: true,
        sharingGroupId: ownerGroup.$jazz.id,
      },
      children: collectionChildren,
      createdAt: new Date(),
    },
    { owner: ownerGroup },
  );
}
