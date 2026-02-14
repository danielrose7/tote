import { useEffect, useState, Component, ErrorInfo, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { SignedIn, SignedOut, useAuth } from "@clerk/chrome-extension";
import { useCoState } from "jazz-tools/react";
import { Group } from "jazz-tools";
import { Block, BlockList } from "@tote/schema";
import type { co } from "jazz-tools";
import { ExtensionProviders, JazzProvider } from "../providers/ExtensionProviders";
import type { ExtractedMetadata, MessagePayload } from "../lib/extractors/types";
import { useCollections } from "../hooks/useCollections";
import { loadOwnerGroup } from "../lib/loadOwnerGroup";

// Error boundary to catch rendering errors
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[Tote] Error boundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="popup">
          <div className="error">
            <strong>Error loading extension:</strong>
            <br />
            {this.state.error?.message || "Unknown error"}
            <br />
            <small>Check console for details</small>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

type Status = "loading" | "ready" | "saving" | "success" | "error";

function formatPrice(price?: string, currency?: string): string {
  if (!price) return "";
  const num = parseFloat(price);
  if (isNaN(num)) return price;

  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  });
  return formatter.format(num);
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

/**
 * Metadata preview component - shown regardless of auth state
 */
function MetadataPreview({ metadata }: { metadata: ExtractedMetadata | null }) {
  if (!metadata) return null;

  return (
    <div className="preview">
      {metadata.imageUrl ? (
        <img
          src={metadata.imageUrl}
          alt=""
          className="preview-image"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <div className="preview-image-placeholder">No image found</div>
      )}
      <div className="preview-content">
        <div className="preview-title">{metadata.title || "Untitled"}</div>
        <div className="preview-url">{getDomain(metadata.url)}</div>
        {metadata.price && (
          <div className="preview-price">
            {formatPrice(metadata.price, metadata.currency)}
          </div>
        )}
        <div className="preview-meta">
          {metadata.platform && metadata.platform !== "unknown" && (
            <span className="meta-tag">{metadata.platform}</span>
          )}
          {metadata.brand && <span className="meta-tag">{metadata.brand}</span>}
        </div>
      </div>
    </div>
  );
}

/**
 * Sign in prompt for unauthenticated users
 */
function SignInPrompt() {
  const handleSignIn = () => {
    // Auth page is on main app, not Clerk domain
    chrome.tabs.create({ url: "https://tote.tools/extension-auth" });
  };

  return (
    <div className="sign-in-prompt">
      <p>Sign in to save products to your collections</p>
      <button className="sign-in-button" onClick={handleSignIn}>
        Sign In
      </button>
    </div>
  );
}

/**
 * Simple slot selector component for the extension
 */
function SlotSelector({
  value,
  onChange,
  slots,
  onCreateSlot,
  disabled = false,
}: {
  value: string | null;
  onChange: (slotId: string | null) => void;
  slots: { id: string; name: string }[];
  onCreateSlot: (name: string) => Promise<string>;
  disabled?: boolean;
}) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const selectedSlot = value ? slots.find((s) => s.id === value) : null;
  const filteredSlots = inputValue
    ? slots.filter((s) => s.name.toLowerCase().includes(inputValue.toLowerCase()))
    : slots;
  const exactMatch = slots.some(
    (s) => s.name.toLowerCase() === inputValue.toLowerCase()
  );
  const showCreateOption = inputValue.trim() && !exactMatch;

  const handleSelect = (slotId: string) => {
    onChange(slotId);
    setInputValue("");
    setIsOpen(false);
  };

  const handleCreate = async () => {
    if (!inputValue.trim() || isCreating) return;
    setIsCreating(true);
    try {
      const newSlotId = await onCreateSlot(inputValue.trim());
      onChange(newSlotId);
      setInputValue("");
      setIsOpen(false);
    } finally {
      setIsCreating(false);
    }
  };

  const handleClear = () => {
    onChange(null);
    setInputValue("");
  };

  if (selectedSlot && !isOpen) {
    return (
      <div className="slot-selected">
        <span>{selectedSlot.name}</span>
        {!disabled && (
          <button type="button" onClick={handleClear} className="slot-clear">
            ×
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="slot-selector">
      <input
        type="text"
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          if (!isOpen) setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        placeholder="Add to slot (optional)"
        disabled={disabled}
      />
      {isOpen && !disabled && (
        <ul className="slot-dropdown">
          {filteredSlots.map((slot) => (
            <li
              key={slot.id}
              onClick={() => handleSelect(slot.id)}
              className={value === slot.id ? "selected" : ""}
            >
              {slot.name}
            </li>
          ))}
          {showCreateOption && (
            <li onClick={handleCreate} className="create-option">
              {isCreating ? "Creating..." : `+ Create "${inputValue.trim()}"`}
            </li>
          )}
          {filteredSlots.length === 0 && !showCreateOption && (
            <li className="empty">
              {slots.length === 0 ? "Type to create a slot" : "No matches"}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

type LoadedBlock = co.loaded<typeof Block>;

/**
 * Component to load a single shared collection
 */
function SharedCollectionLoader({
  collectionId,
  onLoad,
}: {
  collectionId: string;
  onLoad: (collection: LoadedBlock) => void;
}) {
  const collection = useCoState(Block, collectionId as `co_z${string}`, {
    resolve: {
      children: {
        $each: {
          children: { $each: {} },
        },
      },
    },
  });

  useEffect(() => {
    if (collection && collection.$isLoaded && collection.type === "collection") {
      onLoad(collection as LoadedBlock);
    }
  }, [collection, onLoad]);

  return null; // This component only loads data, doesn't render anything
}

/**
 * Save UI for authenticated users - uses Jazz directly
 */
function SaveUI({
  metadata,
  onSuccess,
}: {
  metadata: ExtractedMetadata;
  onSuccess: (collectionId: string) => void;
}) {
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");

  const {
    collections,
    selectedCollection,
    setSelectedCollection,
    slots,
    selectedCollectionBlock,
    sharedRefsToLoad,
    onSharedCollectionLoaded,
    me,
    root,
    isLoading,
  } = useCollections();

  // Create a new slot
  const handleCreateSlot = async (name: string): Promise<string> => {
    if (!selectedCollectionBlock) {
      throw new Error("No collection selected");
    }

    if (!selectedCollectionBlock?.children?.$isLoaded) {
      throw new Error("Collection children not loaded");
    }

    const ownerGroup = await loadOwnerGroup(selectedCollectionBlock);

    // Create empty children list for the slot
    const slotChildren = BlockList.create(
      [],
      ownerGroup ? { owner: ownerGroup } : { owner: selectedCollectionBlock.$jazz.owner }
    );

    const newSlot = Block.create(
      {
        type: "slot",
        name,
        slotData: {
          maxSelections: 1,
        },
        children: slotChildren,
        createdAt: new Date(),
      },
      ownerGroup ? { owner: ownerGroup } : { owner: selectedCollectionBlock.$jazz.owner }
    );

    // Add slot to collection's children
    selectedCollectionBlock.children.$jazz.push(newSlot);
    return newSlot.$jazz.id;
  };

  // Create a new collection
  const handleCreateCollection = async () => {
    const name = newCollectionName.trim();
    if (!name || !me || !root) return;

    setIsCreatingCollection(true);
    try {
      const ownerGroup = Group.create({ owner: me });
      ownerGroup.addMember(me, "admin");

      const childrenList = BlockList.create([], { owner: ownerGroup });

      const newCollection = Block.create(
        {
          type: "collection",
          name,
          collectionData: {
            sharingGroupId: ownerGroup.$jazz.id,
            viewMode: "grid",
          },
          children: childrenList,
          createdAt: new Date(),
        },
        { owner: ownerGroup }
      );

      // Add to root blocks
      if (!root.blocks?.$isLoaded) {
        const blocksList = BlockList.create([newCollection], me);
        root.$jazz.set("blocks", blocksList);
      } else {
        root.blocks.$jazz.push(newCollection);
      }

      setSelectedCollection(newCollection.$jazz.id);
      setSelectedSlot(null);
      setNewCollectionName("");
      setShowNewCollection(false);
    } catch (err) {
      console.error("[Tote] Create collection error:", err);
      setError(err instanceof Error ? err.message : "Failed to create collection");
    } finally {
      setIsCreatingCollection(false);
    }
  };

  const handleSave = async () => {
    if (!me || !root || !root.blocks?.$isLoaded || !selectedCollection) {
      setError("No collection selected");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const collection = collections.find(
        (c) => c.$jazz.id === selectedCollection
      );

      if (!collection) {
        throw new Error("Collection not found");
      }

      const ownerGroup = await loadOwnerGroup(collection);

      // Create the product block owned by the group
      const newProductBlock = Block.create(
        {
          type: "product",
          name: metadata.title || "Untitled",
          productData: {
            url: metadata.url,
            imageUrl: metadata.imageUrl,
            price: metadata.price,
            description: metadata.description,
          },
          createdAt: new Date(),
        },
        ownerGroup ? { owner: ownerGroup } : { owner: collection.$jazz.owner }
      );

      // Add to the appropriate parent's children list
      if (selectedSlot) {
        // Find the slot and add to its children
        let slotBlock: any = null;
        if (collection.children?.$isLoaded) {
          for (const b of collection.children) {
            if (b && b.$isLoaded && b.$jazz.id === selectedSlot) {
              slotBlock = b;
              break;
            }
          }
        }
        if (slotBlock?.children?.$isLoaded) {
          slotBlock.children.$jazz.push(newProductBlock);
          await slotBlock.children.$jazz.waitForSync({ timeout: 5000 });
        }
      } else {
        // Add directly to collection's children
        if (collection.children?.$isLoaded) {
          collection.children.$jazz.push(newProductBlock);
          await collection.children.$jazz.waitForSync({ timeout: 5000 });
        }
      }

      onSuccess(selectedCollection);
    } catch (err) {
      console.error("[Tote] Save error:", err);
      setError(err instanceof Error ? err.message : "Failed to save link");
      setSaving(false);
    }
  };

  // Loading state while Jazz loads
  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <span>Loading collections...</span>
      </div>
    );
  }

  if (collections.length === 0 && !showNewCollection) {
    return (
      <div className="empty-collections">
        <p>No collections yet.</p>
        <button
          className="save-button"
          onClick={() => setShowNewCollection(true)}
        >
          Add Collection
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Load shared collections in background (skip ones we already own) */}
      {sharedRefsToLoad.map((ref) => (
        <SharedCollectionLoader
          key={ref.collectionId}
          collectionId={ref.collectionId}
          onLoad={onSharedCollectionLoaded}
        />
      ))}

      {error && <div className="error">{error}</div>}

      <div className="form-group">
        <label htmlFor="collection">Collection</label>
        {collections.length > 0 && (
          <div className="collection-row">
            <select
              id="collection"
              value={selectedCollection}
              onChange={(e) => {
                setSelectedCollection(e.target.value);
                setSelectedSlot(null);
              }}
              disabled={saving || isCreatingCollection}
            >
              {collections.map((col) => (
                <option key={col.$jazz.id} value={col.$jazz.id}>
                  {col.name || "Unnamed collection"}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="add-collection-button"
              onClick={() => {
                setShowNewCollection(!showNewCollection);
                setNewCollectionName("");
              }}
              disabled={saving || isCreatingCollection}
              title="Add collection"
            >
              {showNewCollection ? "\u00d7" : "+"}
            </button>
          </div>
        )}
        {showNewCollection && (
          <div className="new-collection-row">
            <input
              type="text"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newCollectionName.trim()) handleCreateCollection();
                if (e.key === "Escape") {
                  setShowNewCollection(false);
                  setNewCollectionName("");
                }
              }}
              placeholder="Collection name"
              disabled={isCreatingCollection}
              autoFocus
            />
            <button
              type="button"
              className="new-collection-confirm"
              onClick={handleCreateCollection}
              disabled={!newCollectionName.trim() || isCreatingCollection}
            >
              {isCreatingCollection ? "..." : "Add"}
            </button>
          </div>
        )}
      </div>

      <div className="form-group">
        <label>Slot <span className="optional">(optional)</span></label>
        <SlotSelector
          value={selectedSlot}
          onChange={setSelectedSlot}
          slots={slots}
          onCreateSlot={handleCreateSlot}
          disabled={saving}
        />
      </div>

      <button className="save-button" onClick={handleSave} disabled={saving || !selectedCollection}>
        {saving ? "Saving..." : "Save to Tote"}
      </button>
    </>
  );
}

/**
 * Main popup content
 */
function PopupContent() {
  const [status, setStatus] = useState<Status>("loading");
  const [metadata, setMetadata] = useState<ExtractedMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedCollectionId, setSavedCollectionId] = useState<string | null>(null);
  const { isLoaded } = useAuth();

  // Extract metadata from current tab
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) {
        setError("No active tab found");
        setStatus("error");
        return;
      }

      chrome.tabs.sendMessage(
        tab.id,
        { type: "EXTRACT_METADATA" } as MessagePayload,
        (response: MessagePayload) => {
          if (chrome.runtime.lastError) {
            setError("Could not extract metadata. Try refreshing the page.");
            setStatus("error");
            return;
          }

          if (response?.error) {
            setError(response.error);
            setStatus("error");
            return;
          }

          if (response?.data) {
            setMetadata(response.data);
            setStatus("ready");
          }
        }
      );
    });
  }, []);

  const handleSuccess = (collectionId: string) => {
    setSavedCollectionId(collectionId);
    setStatus("success");
  };

  // Wait for Clerk to load
  if (!isLoaded) {
    return (
      <div className="loading">
        <div className="spinner" />
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <div className="popup">
      <header className="header">
        <div className="logo" />
        <h1>Save to Tote</h1>
      </header>

      {status === "loading" && (
        <div className="loading">
          <div className="spinner" />
          <span>Extracting product info...</span>
        </div>
      )}

      {status === "error" && (
        <div className="error">{error || "Something went wrong"}</div>
      )}

      {status === "success" && (
        <div className="success">
          <div className="success-icon">&#10003;</div>
          <h2>Saved to Tote!</h2>
          <p>Product added to your collection</p>
          {savedCollectionId && (
            <button
              className="open-tote-button"
              onClick={() => {
                chrome.tabs.create({
                  url: `https://tote.tools/collections/${savedCollectionId}`,
                });
              }}
            >
              Open Tote
            </button>
          )}
        </div>
      )}

      {status === "ready" && metadata && (
        <>
          <MetadataPreview metadata={metadata} />

          <SignedOut>
            <SignInPrompt />
          </SignedOut>

          <SignedIn>
            <JazzProvider>
              <SaveUI metadata={metadata} onSuccess={handleSuccess} />
            </JazzProvider>
          </SignedIn>
        </>
      )}
    </div>
  );
}

/**
 * Root component with providers
 */
function App() {
  return (
    <ErrorBoundary>
      <ExtensionProviders>
        <PopupContent />
      </ExtensionProviders>
    </ErrorBoundary>
  );
}

const rootElement = document.getElementById("root");
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}
