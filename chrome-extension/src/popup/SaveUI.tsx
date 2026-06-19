import { useAuth } from '@clerk/chrome-extension';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APP_URL } from '../config';
import {
  type CaptureOutboxEntry,
  flushOutbox,
  readCachedIndex,
  readLastSelectedCollection,
  readOutbox,
  removeOutboxEntry,
  requeueOutboxEntry,
  submitCapture,
  syncActiveAccount,
  writeCachedIndex,
  writeLastSelectedCollection,
} from '../lib/captureStore';
import type { ExtractedMetadata } from '../lib/extractors/types';
import {
  buildCapturePayload,
  type CaptureIds,
  createCaptureIds,
  createCollection,
  fetchCaptureCollections,
  type CaptureCollection,
  CaptureRequestError,
} from '../lib/captureApi';

export function SaveUI({
  metadata,
  onSuccess,
  onQueued,
  onUnavailable,
}: {
  metadata: ExtractedMetadata;
  onSuccess: (collectionId: string) => void;
  onQueued: (collectionId: string) => void;
  onUnavailable: () => void;
}) {
  const { getToken, userId } = useAuth();
  const [collections, setCollections] = useState<CaptureCollection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // True while the picker shows the cached index because the network read
  // failed; the user can still queue saves into the outbox.
  const [offline, setOffline] = useState(false);
  const [outbox, setOutbox] = useState<CaptureOutboxEntry[]>([]);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [creating, setCreating] = useState(false);
  // Stable per-capture identity so a retry replays the original save instead
  // of inserting a duplicate. Reset when the destination changes.
  const captureIds = useRef<CaptureIds | null>(null);
  // Same idea for collection creation: stable ids per attempt, reset when the
  // name changes so a different request never reuses a mutation id.
  const createIds = useRef<CaptureIds | null>(null);
  const selected = useMemo(
    () =>
      collections.find((collection) => collection.id === selectedCollection),
    [collections, selectedCollection],
  );
  const pendingCount = useMemo(
    () => outbox.filter((entry) => entry.status !== 'failed').length,
    [outbox],
  );
  const failedEntries = useMemo(
    () => outbox.filter((entry) => entry.status === 'failed'),
    [outbox],
  );

  const refreshOutbox = useCallback(async () => {
    if (!userId) return;
    setOutbox(await readOutbox(userId));
  }, [userId]);

  const applySelection = useCallback(
    async (nextCollections: CaptureCollection[], accountId: string) => {
      const storedId = await readLastSelectedCollection(accountId);
      setSelectedCollection((current) => {
        if (nextCollections.some((collection) => collection.id === current)) {
          return current;
        }
        return nextCollections.some((collection) => collection.id === storedId)
          ? (storedId as string)
          : (nextCollections[0]?.id ?? '');
      });
    },
    [],
  );

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = async () => {
      await syncActiveAccount(userId);
      void flushOutbox(userId, getToken).then(() => {
        if (!cancelled) void refreshOutbox();
      });
      const cached = await readCachedIndex(userId);
      if (cached && !cancelled) {
        setCollections(cached.collections);
        await applySelection(cached.collections, userId);
        setLoading(false);
      }
      try {
        const token = await getToken();
        if (!token) throw new Error('Your Tote session is unavailable.');
        const nextCollections = await fetchCaptureCollections(token);
        if (cancelled) return;
        // A successful read is the authoritative index; it also drops
        // collections the account can no longer write to.
        await writeCachedIndex(userId, nextCollections);
        setCollections(nextCollections);
        setOffline(false);
        await applySelection(nextCollections, userId);
      } catch (loadError) {
        if (
          loadError instanceof CaptureRequestError &&
          [404, 409].includes(loadError.status)
        ) {
          onUnavailable();
          return;
        }
        if (!cancelled) {
          if (cached) {
            setOffline(true);
          } else {
            setError(
              loadError instanceof Error
                ? loadError.message
                : 'Could not load collections.',
            );
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [userId, getToken, onUnavailable, refreshOutbox, applySelection]);

  useEffect(() => {
    if (!userId) return;
    const onOnline = () => {
      void flushOutbox(userId, getToken).then(() => refreshOutbox());
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [userId, getToken, refreshOutbox]);

  const chooseCollection = (collectionId: string) => {
    captureIds.current = null;
    setSelectedCollection(collectionId);
    setSelectedSection('');
    if (userId) void writeLastSelectedCollection(userId, collectionId);
  };

  const chooseSection = (sectionId: string) => {
    captureIds.current = null;
    setSelectedSection(sectionId);
  };

  // Creation is online-only; offline users keep the cached picker and outbox.
  const createCollection = async () => {
    const name = newCollectionName.trim();
    if (!name || !userId) return;
    setCreating(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Your Tote session is unavailable.');
      createIds.current ??= createCaptureIds();
      const result = await createCollection({
        token,
        ids: createIds.current,
        name,
      });
      createIds.current = null;
      const created: CaptureCollection = {
        id: result.id,
        name,
        color: null,
        role: 'owner',
        sections: [],
      };
      const nextCollections = collections.some(
        (collection) => collection.id === created.id,
      )
        ? collections
        : [...collections, created];
      setCollections(nextCollections);
      await writeCachedIndex(userId, nextCollections);
      chooseCollection(created.id);
      setShowNewCollection(false);
      setNewCollectionName('');
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Could not create collection.',
      );
    } finally {
      setCreating(false);
    }
  };

  const save = async () => {
    if (!selectedCollection || !userId) return;
    setSaving(true);
    setError(null);
    captureIds.current ??= createCaptureIds();
    const outcome = await submitCapture({
      userId,
      payload: buildCapturePayload({
        ids: captureIds.current,
        collectionId: selectedCollection,
        sectionId: selectedSection || null,
        metadata,
      }),
      getToken,
    });
    if (outcome.status === 'saved') {
      captureIds.current = null;
      onSuccess(selectedCollection);
      return;
    }
    if (outcome.status === 'queued') {
      captureIds.current = null;
      onQueued(selectedCollection);
      return;
    }
    setError(outcome.message);
    await refreshOutbox();
    setSaving(false);
  };

  const retryEntry = async (nodeId: string) => {
    if (!userId) return;
    await requeueOutboxEntry(userId, nodeId);
    await flushOutbox(userId, getToken);
    await refreshOutbox();
  };

  const discardEntry = async (nodeId: string) => {
    if (!userId) return;
    await removeOutboxEntry(userId, nodeId);
    await refreshOutbox();
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <span>Loading collections...</span>
      </div>
    );
  }
  if (error && collections.length === 0 && !showNewCollection) {
    return <div className="error">{error}</div>;
  }
  if (collections.length === 0 && !showNewCollection) {
    return (
      <div className="empty-collections">
        <p>No writable collections yet.</p>
        {offline ? (
          <button
            type="button"
            className="save-button"
            onClick={() =>
              chrome.tabs.create({ url: `${APP_URL}/collections` })
            }
          >
            Open Tote
          </button>
        ) : (
          <button
            type="button"
            className="save-button"
            onClick={() => setShowNewCollection(true)}
          >
            Add Collection
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      {offline && (
        <div className="offline-banner">
          Offline — showing saved collections. Saves will sync when you're back
          online.
        </div>
      )}
      {error && <div className="error">{error}</div>}
      <div className="form-group">
        <label htmlFor="neon-collection">Collection</label>
        {collections.length > 0 && (
          <div className="collection-row">
            <select
              id="neon-collection"
              value={selectedCollection}
              onChange={(event) => chooseCollection(event.target.value)}
              disabled={saving || creating}
            >
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="add-collection-button"
              onClick={() => {
                setShowNewCollection(!showNewCollection);
                setNewCollectionName('');
                createIds.current = null;
              }}
              disabled={saving || creating || offline}
              title={
                offline
                  ? 'Creating collections requires a connection'
                  : 'Add collection'
              }
            >
              {showNewCollection ? '×' : '+'}
            </button>
          </div>
        )}
        {showNewCollection && (
          <div className="new-collection-row">
            <input
              type="text"
              value={newCollectionName}
              onChange={(event) => {
                setNewCollectionName(event.target.value);
                createIds.current = null;
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && newCollectionName.trim())
                  void createCollection();
                if (event.key === 'Escape') {
                  setShowNewCollection(false);
                  setNewCollectionName('');
                }
              }}
              placeholder="Collection name"
              disabled={creating}
            />
            <button
              type="button"
              className="new-collection-confirm"
              onClick={() => void createCollection()}
              disabled={!newCollectionName.trim() || creating}
            >
              {creating ? '...' : 'Add'}
            </button>
          </div>
        )}
      </div>
      <div className="form-group">
        <label htmlFor="neon-section">
          Section <span className="optional">(optional)</span>
        </label>
        <select
          id="neon-section"
          value={selectedSection}
          onChange={(event) => chooseSection(event.target.value)}
          disabled={saving || !selected?.sections.length}
        >
          <option value="">No section</option>
          {selected?.sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        className="save-button"
        onClick={save}
        disabled={saving || !selectedCollection}
      >
        {saving ? 'Saving...' : 'Save to Tote'}
      </button>
      {pendingCount > 0 && (
        <div className="outbox-status">
          {pendingCount} {pendingCount === 1 ? 'save' : 'saves'} waiting to sync
        </div>
      )}
      {failedEntries.map((entry) => (
        <div className="outbox-failed" key={entry.nodeId}>
          <div className="outbox-failed-info">
            <span className="outbox-failed-title">{entry.payload.title}</span>
            <span className="outbox-failed-error">{entry.lastError}</span>
          </div>
          <div className="outbox-failed-actions">
            <button type="button" onClick={() => retryEntry(entry.nodeId)}>
              Retry
            </button>
            <button type="button" onClick={() => discardEntry(entry.nodeId)}>
              Remove
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
