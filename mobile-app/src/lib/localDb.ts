import * as SQLite from 'expo-sqlite';
import type { Collection, CollectionNode } from './api';

let db: SQLite.SQLiteDatabase | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('tote.db');
  }
  return db;
}

export async function setupDatabase(): Promise<void> {
  const database = getDb();
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT,
      item_count INTEGER NOT NULL DEFAULT 0,
      position_key TEXT NOT NULL,
      role TEXT NOT NULL,
      owner_user_id TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS collection_nodes (
      id TEXT PRIMARY KEY,
      collection_id TEXT NOT NULL,
      parent_id TEXT,
      type TEXT NOT NULL,
      title TEXT,
      properties TEXT NOT NULL DEFAULT '{}',
      position_key TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );
  `);
}

export async function getCachedCollections(): Promise<Collection[]> {
  try {
    const database = getDb();
    const rows = await database.getAllAsync<{
      id: string;
      name: string;
      description: string | null;
      color: string | null;
      item_count: number;
      position_key: string;
      role: string;
      owner_user_id: string;
      updated_at: string;
    }>(
      'SELECT id, name, description, color, item_count, position_key, role, owner_user_id, updated_at FROM collections ORDER BY position_key ASC',
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      color: r.color,
      itemCount: r.item_count,
      positionKey: r.position_key,
      role: r.role as Collection['role'],
      ownerUserId: r.owner_user_id,
      updatedAt: r.updated_at,
      previewImages: [],
    }));
  } catch {
    return [];
  }
}

export async function upsertCollections(
  collections: Collection[],
): Promise<void> {
  try {
    const database = getDb();
    const now = new Date().toISOString();
    await database.withTransactionAsync(async () => {
      for (const col of collections) {
        await database.runAsync(
          `INSERT INTO collections (id, name, description, color, item_count, position_key, role, owner_user_id, updated_at, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             description = excluded.description,
             color = excluded.color,
             item_count = excluded.item_count,
             position_key = excluded.position_key,
             role = excluded.role,
             owner_user_id = excluded.owner_user_id,
             updated_at = excluded.updated_at,
             synced_at = excluded.synced_at`,
          [
            col.id,
            col.name,
            col.description ?? null,
            col.color ?? null,
            col.itemCount,
            col.positionKey,
            col.role,
            col.ownerUserId,
            col.updatedAt,
            now,
          ],
        );
      }
    });
  } catch (e) {
    console.warn('upsertCollections error:', e);
  }
}

export async function deleteCachedCollection(id: string): Promise<void> {
  try {
    const database = getDb();
    await database.runAsync('DELETE FROM collections WHERE id = ?', [id]);
    await database.runAsync(
      'DELETE FROM collection_nodes WHERE collection_id = ?',
      [id],
    );
  } catch (e) {
    console.warn('deleteCachedCollection error:', e);
  }
}

export async function getCachedNodes(
  collectionId: string,
): Promise<CollectionNode[]> {
  try {
    const database = getDb();
    const rows = await database.getAllAsync<{
      id: string;
      collection_id: string;
      parent_id: string | null;
      type: string;
      title: string | null;
      properties: string;
      position_key: string;
      version: number;
      updated_at: string;
    }>(
      'SELECT * FROM collection_nodes WHERE collection_id = ? ORDER BY position_key ASC',
      [collectionId],
    );
    return rows.map((r) => ({
      id: r.id,
      collectionId: r.collection_id,
      parentId: r.parent_id,
      type: r.type as CollectionNode['type'],
      title: r.title,
      properties: JSON.parse(r.properties ?? '{}'),
      positionKey: r.position_key,
      version: r.version,
      createdAt: r.updated_at,
      updatedAt: r.updated_at,
    }));
  } catch {
    return [];
  }
}

export async function upsertNodes(nodes: CollectionNode[]): Promise<void> {
  try {
    const database = getDb();
    await database.withTransactionAsync(async () => {
      for (const node of nodes) {
        await database.runAsync(
          `INSERT INTO collection_nodes (id, collection_id, parent_id, type, title, properties, position_key, version, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             collection_id = excluded.collection_id,
             parent_id = excluded.parent_id,
             type = excluded.type,
             title = excluded.title,
             properties = excluded.properties,
             position_key = excluded.position_key,
             version = excluded.version,
             updated_at = excluded.updated_at`,
          [
            node.id,
            node.collectionId,
            node.parentId ?? null,
            node.type,
            node.title ?? null,
            JSON.stringify(node.properties ?? {}),
            node.positionKey,
            node.version,
            node.updatedAt,
          ],
        );
      }
    });
  } catch (e) {
    console.warn('upsertNodes error:', e);
  }
}

export async function upsertNode(node: CollectionNode): Promise<void> {
  return upsertNodes([node]);
}

export async function deleteCachedNode(id: string): Promise<void> {
  try {
    const database = getDb();
    await database.runAsync('DELETE FROM collection_nodes WHERE id = ?', [id]);
  } catch (e) {
    console.warn('deleteCachedNode error:', e);
  }
}

export async function clearNodeCache(collectionId: string): Promise<void> {
  try {
    const database = getDb();
    await database.runAsync(
      'DELETE FROM collection_nodes WHERE collection_id = ?',
      [collectionId],
    );
  } catch (e) {
    console.warn('clearNodeCache error:', e);
  }
}

export async function clearAllCachedData(): Promise<void> {
  try {
    const database = getDb();
    await database.withTransactionAsync(async () => {
      await database.runAsync('DELETE FROM collection_nodes');
      await database.runAsync('DELETE FROM collections');
    });
  } catch (e) {
    console.warn('clearAllCachedData error:', e);
  }
}
