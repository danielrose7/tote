import * as Dialog from '@radix-ui/react-dialog';
import { useState, useEffect, useCallback } from 'react';
import type { JazzAccount, Block } from '../../schema.ts';
import type { co } from 'jazz-tools';
import { Group } from 'jazz-tools';
import { Block as BlockSchema } from '../../schema';
import { fetchMetadata } from '../../app/utils/metadata';
import { useToast } from '../ToastNotification';
import { useAllCollections } from '../../hooks/useAllCollections';
import { SlotSelector } from '../SlotSelector/SlotSelector';
import { BlockList } from '../../schema';
import {
  checkExtensionAvailable,
  getAllTabs,
  extractTabMetadata,
  type TabInfo,
} from '../../lib/extension';
import { CHROME_WEB_STORE_URL } from '../../lib/constants';
import styles from './SaveTabsDialog.module.css';

type LoadedBlock = co.loaded<typeof Block>;

interface SaveTabsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: co.loaded<typeof JazzAccount>;
  collectionId?: string;
}

type DialogState =
  | { type: 'loading' }
  | { type: 'no-extension' }
  | { type: 'tabs'; tabs: TabInfo[] }
  | { type: 'saving'; current: number; total: number }
  | { type: 'error'; message: string };

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function SaveTabsDialog({
  open,
  onOpenChange,
  account,
  collectionId,
}: SaveTabsDialogProps) {
  const { showToast } = useToast();
  const [state, setState] = useState<DialogState>({ type: 'loading' });
  const [selectedTabIds, setSelectedTabIds] = useState<Set<number>>(new Set());
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [createdSlots, setCreatedSlots] = useState<LoadedBlock[]>([]);

  const { collections, findCollection } = useAllCollections(account);

  const defaultCollectionId =
    collectionId ||
    (account.root?.$isLoaded ? account.root.defaultBlockId || null : null);

  // Load tabs when dialog opens
  const loadTabs = useCallback(async () => {
    setState({ type: 'loading' });

    const available = await checkExtensionAvailable();
    if (!available) {
      setState({ type: 'no-extension' });
      return;
    }

    try {
      const tabs = await getAllTabs();
      setState({ type: 'tabs', tabs });
      // Select all extractable tabs by default
      setSelectedTabIds(
        new Set(tabs.filter((t) => t.extractable).map((t) => t.tabId)),
      );
    } catch (error) {
      setState({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to get tabs',
      });
    }
  }, []);

  useEffect(() => {
    if (open) {
      setSelectedCollectionId(defaultCollectionId || '');
      setSelectedSlotId(null);
      setCreatedSlots([]);
      loadTabs();
    }
  }, [open, loadTabs, defaultCollectionId]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const toggleTab = (tabId: number) => {
    setSelectedTabIds((prev) => {
      const next = new Set(prev);
      if (next.has(tabId)) {
        next.delete(tabId);
      } else {
        next.add(tabId);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (state.type !== 'tabs') return;
    setSelectedTabIds(
      new Set(state.tabs.filter((t) => t.extractable).map((t) => t.tabId)),
    );
  };

  const selectNone = () => {
    setSelectedTabIds(new Set());
  };

  const allExtractableSelected =
    state.type === 'tabs' &&
    state.tabs
      .filter((t) => t.extractable)
      .every((t) => selectedTabIds.has(t.tabId));

  // Get slots for the currently selected collection
  const getSlotsForSelectedCollection = (): LoadedBlock[] => {
    if (!selectedCollectionId) return [];
    const collectionBlock = findCollection(selectedCollectionId);
    const existingSlots: LoadedBlock[] = [];
    if (collectionBlock?.children?.$isLoaded) {
      for (const child of collectionBlock.children) {
        if (child && child.$isLoaded && child.type === 'slot') {
          existingSlots.push(child);
        }
      }
    }
    const existingIds = new Set(existingSlots.map((s) => s.$jazz.id));
    const newSlots = createdSlots.filter((s) => !existingIds.has(s.$jazz.id));
    return [...existingSlots, ...newSlots];
  };

  const handleCreateSlot = async (name: string): Promise<string> => {
    const collectionBlock = findCollection(selectedCollectionId);
    if (!collectionBlock?.children?.$isLoaded) {
      throw new Error('Collection children not loaded');
    }

    let ownerGroup: Group | null = null;
    const sharingGroupId = collectionBlock?.collectionData?.sharingGroupId;
    if (sharingGroupId) {
      ownerGroup = await Group.load(sharingGroupId as `co_z${string}`, {});
    }

    const slotChildren = BlockList.create(
      [],
      ownerGroup ? { owner: ownerGroup } : account.$jazz,
    );

    const newSlot = BlockSchema.create(
      {
        type: 'slot',
        name,
        slotData: { maxSelections: 1 },
        children: slotChildren,
        createdAt: new Date(),
      },
      ownerGroup ? { owner: ownerGroup } : account.$jazz,
    );

    collectionBlock.children.$jazz.push(newSlot);
    setCreatedSlots((prev) => [...prev, newSlot as LoadedBlock]);
    return newSlot.$jazz.id;
  };

  const handleSave = async () => {
    if (state.type !== 'tabs' || selectedTabIds.size === 0) return;
    if (!selectedCollectionId) return;
    if (!account.root || !account.root.$isLoaded) return;

    const collectionBlock = findCollection(selectedCollectionId);
    if (!collectionBlock) return;

    const selectedTabs = state.tabs.filter((t) => selectedTabIds.has(t.tabId));
    const total = selectedTabs.length;

    setState({ type: 'saving', current: 0, total });

    // Get the collection's sharing group for proper ownership
    let ownerGroup: Group | null = null;
    const sharingGroupId = collectionBlock?.collectionData?.sharingGroupId;
    if (sharingGroupId) {
      ownerGroup = await Group.load(sharingGroupId as `co_z${string}`, {});
    }

    // Determine the parent to add blocks to
    let parentBlock = collectionBlock;
    if (selectedSlotId) {
      const slotBlock = collectionBlock.children?.find(
        (b) => b && b.$isLoaded && b.$jazz.id === selectedSlotId,
      );
      if (slotBlock?.children?.$isLoaded) {
        parentBlock = slotBlock;
      }
    }

    let savedCount = 0;

    for (let i = 0; i < selectedTabs.length; i++) {
      const tab = selectedTabs[i];
      setState({ type: 'saving', current: i, total });

      let metadata: {
        title?: string;
        description?: string;
        imageUrl?: string;
        price?: string;
        url?: string;
      } = {};

      // Try extension extraction first (tab is already open)
      if (tab.extractable) {
        try {
          const extracted = await extractTabMetadata(tab.tabId);
          if (extracted) {
            metadata = extracted;
          }
        } catch {
          // Fall through to server-side
        }
      }

      // Fall back to server-side extraction
      if (!metadata.title && !metadata.imageUrl) {
        try {
          const serverMeta = await fetchMetadata(tab.url);
          metadata = {
            title: serverMeta.title,
            description: serverMeta.description,
            imageUrl: serverMeta.imageUrl,
            price: serverMeta.price,
          };
        } catch {
          // Use basic tab info
        }
      }

      const newProductBlock = BlockSchema.create(
        {
          type: 'product',
          name: metadata.title || tab.title || 'Untitled',
          productData: {
            url: tab.url,
            imageUrl: metadata.imageUrl,
            price: metadata.price,
            description: metadata.description,
          },
          createdAt: new Date(),
        },
        ownerGroup ? { owner: ownerGroup } : account.$jazz,
      );

      if (parentBlock.children?.$isLoaded) {
        parentBlock.children.$jazz.push(newProductBlock);
        savedCount++;
      }
    }

    setState({ type: 'saving', current: total, total });

    showToast({
      title: 'Tabs saved',
      description: `${savedCount} ${savedCount === 1 ? 'tab' : 'tabs'} saved to ${collectionBlock.name}`,
      variant: 'success',
    });

    handleClose();
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <Dialog.Title className={styles.title}>Save My Tabs</Dialog.Title>
          <Dialog.Description className={styles.description}>
            Select tabs to save as product links
          </Dialog.Description>

          {state.type === 'loading' && (
            <div className={styles.loading}>Checking extension...</div>
          )}

          {state.type === 'no-extension' && (
            <div className={styles.installPrompt}>
              <p className={styles.installPromptText}>
                The Tote browser extension is required to access your open tabs.
              </p>
              <a
                href={CHROME_WEB_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.installButton}
              >
                Install Extension
              </a>
            </div>
          )}

          {state.type === 'error' && (
            <div className={styles.error}>{state.message}</div>
          )}

          {state.type === 'tabs' && (
            <>
              <div className={styles.selectControls}>
                <button
                  type="button"
                  className={styles.selectToggle}
                  onClick={allExtractableSelected ? selectNone : selectAll}
                >
                  {allExtractableSelected ? 'Select None' : 'Select All'}
                </button>
                <span className={styles.tabCount}>
                  {selectedTabIds.size} of{' '}
                  {state.tabs.filter((t) => t.extractable).length} tabs selected
                </span>
              </div>

              <ul className={styles.tabList}>
                {state.tabs.map((tab) => (
                  <li
                    key={tab.tabId}
                    className={`${styles.tabItem} ${!tab.extractable ? styles.tabItemDisabled : ''}`}
                    onClick={() => tab.extractable && toggleTab(tab.tabId)}
                  >
                    <input
                      type="checkbox"
                      className={styles.tabCheckbox}
                      checked={selectedTabIds.has(tab.tabId)}
                      disabled={!tab.extractable}
                      onChange={() => tab.extractable && toggleTab(tab.tabId)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    {tab.favIconUrl ? (
                      <img
                        src={tab.favIconUrl}
                        alt=""
                        className={styles.tabFavicon}
                      />
                    ) : (
                      <div className={styles.tabFaviconPlaceholder} />
                    )}
                    <div className={styles.tabInfo}>
                      <div className={styles.tabTitle}>{tab.title}</div>
                      <div className={styles.tabDomain}>
                        {getDomain(tab.url)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Collection Selector */}
              {collections.length > 0 && (
                <div className={styles.inputGroup}>
                  <label
                    htmlFor="saveTabsCollectionId"
                    className={styles.label}
                  >
                    Collection
                  </label>
                  <select
                    id="saveTabsCollectionId"
                    value={selectedCollectionId}
                    onChange={(e) => {
                      setSelectedCollectionId(e.target.value);
                      setSelectedSlotId(null);
                    }}
                    className={styles.select}
                  >
                    {collections.map((block) => (
                      <option key={block.$jazz.id} value={block.$jazz.id}>
                        {block.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Slot Selector */}
              {selectedCollectionId && (
                <div className={styles.inputGroup}>
                  <label className={styles.label}>
                    Slot <span className={styles.optional}>(optional)</span>
                  </label>
                  <SlotSelector
                    value={selectedSlotId}
                    onChange={setSelectedSlotId}
                    slots={getSlotsForSelectedCollection()}
                    onCreateSlot={handleCreateSlot}
                    placeholder="Add to slot (optional)"
                  />
                </div>
              )}

              <div className={styles.actions}>
                <Dialog.Close asChild>
                  <button type="button" className={styles.cancelButton}>
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  type="button"
                  className={styles.saveButton}
                  disabled={selectedTabIds.size === 0 || !selectedCollectionId}
                  onClick={handleSave}
                >
                  Save {selectedTabIds.size}{' '}
                  {selectedTabIds.size === 1 ? 'Tab' : 'Tabs'}
                </button>
              </div>
            </>
          )}

          {state.type === 'saving' && (
            <div className={styles.progress}>
              Saving {state.current}/{state.total} tabs...
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
