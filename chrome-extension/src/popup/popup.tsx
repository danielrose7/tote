import { useEffect, useState, Component, ErrorInfo, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { SignedIn, SignedOut, useAuth } from "@clerk/chrome-extension";
import { useAccount } from "jazz-tools/react";
import { JazzAccount, Block } from "@tote/schema";
import type { co } from "jazz-tools";
import { ExtensionProviders, JazzProvider } from "../providers/ExtensionProviders";
import { SYNC_HOST } from "../config";
import type { ExtractedMetadata, MessagePayload } from "../lib/extractors/types";

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
    chrome.tabs.create({ url: `${SYNC_HOST}/extension-auth` });
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
 * Save UI for authenticated users - uses Jazz directly
 */
function SaveUI({
  metadata,
  onSuccess,
}: {
  metadata: ExtractedMetadata;
  onSuccess: () => void;
}) {
  const [selectedCollection, setSelectedCollection] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get user's Jazz account with blocks loaded
  const me = useAccount(JazzAccount, {
    resolve: {
      root: {
        blocks: { $each: {} },
      },
    },
  });

  // Check if account and root are loaded
  const isLoaded = me && "$isLoaded" in me && me.$isLoaded;
  const root = isLoaded ? me.root : null;
  const rootLoaded = root && "$isLoaded" in root && root.$isLoaded;

  // Get collection blocks (top-level collections without parentId)
  type LoadedBlock = co.loaded<typeof Block>;
  const collections: LoadedBlock[] = [];
  if (rootLoaded && root.blocks?.$isLoaded) {
    for (const b of Array.from(root.blocks)) {
      if (b && b.$isLoaded && b.type === "collection" && !b.parentId) {
        collections.push(b as LoadedBlock);
      }
    }
  }

  // Set default collection when collections load
  // Use the user's default collection, or fall back to the first one
  useEffect(() => {
    if (collections.length > 0 && !selectedCollection) {
      const defaultId = root?.defaultBlockId;

      // Try to use the user's default collection
      if (defaultId) {
        const defaultCollection = collections.find(
          (c) => c.$jazz.id === defaultId
        );
        if (defaultCollection) {
          setSelectedCollection(defaultCollection.$jazz.id);
          return;
        }
      }

      // Fall back to first collection
      const firstCollection = collections[0];
      if (firstCollection) {
        setSelectedCollection(firstCollection.$jazz.id);
      }
    }
  }, [collections, selectedCollection, root?.defaultBlockId]);

  const handleSave = async () => {
    if (!me || !isLoaded || !root || !root.blocks?.$isLoaded || !selectedCollection) {
      setError("No collection selected");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Find the selected collection
      const collection = collections.find(
        (c) => c.$jazz.id === selectedCollection
      );

      if (!collection) {
        throw new Error("Collection not found");
      }

      // Create a new product Block directly in Jazz
      // Use the root blocks' owner for proper permissions
      const newProductBlock = Block.create(
        {
          type: "product",
          name: metadata.title || "Untitled",
          productData: {
            url: metadata.url,
            imageUrl: metadata.imageUrl,
            price: metadata.price,
            description: metadata.description,
            status: "considering",
          },
          parentId: selectedCollection, // Link to the collection
          createdAt: new Date(),
        },
        { owner: root.blocks.$jazz.owner }
      );

      // Add to root blocks
      root.blocks.$jazz.push(newProductBlock);

      // Wait for sync to complete before showing success
      await root.blocks.$jazz.waitForSync({ timeout: 5000 });

      onSuccess();
    } catch (err) {
      console.error("[Tote] Save error:", err);
      setError(err instanceof Error ? err.message : "Failed to save link");
      setSaving(false);
    }
  };

  // Loading state while Jazz loads
  if (!isLoaded || !rootLoaded) {
    return (
      <div className="loading">
        <div className="spinner" />
        <span>Loading collections...</span>
      </div>
    );
  }

  if (collections.length === 0) {
    return (
      <div className="error">
        No collections found. Please create a collection on the web app first.
      </div>
    );
  }

  return (
    <>
      {error && <div className="error">{error}</div>}

      <div className="form-group">
        <label htmlFor="collection">Collection</label>
        <select
          id="collection"
          value={selectedCollection}
          onChange={(e) => setSelectedCollection(e.target.value)}
          disabled={saving}
        >
          {collections.map((col) => (
            <option key={col.$jazz.id} value={col.$jazz.id}>
              {col.name || "Unnamed collection"}
            </option>
          ))}
        </select>
      </div>

      <button className="save-button" onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save to Tote"}
      </button>

      <details className="debug">
        <summary>Debug Info</summary>
        <pre>
          {JSON.stringify(
            {
              authType: "Clerk + Jazz Native",
              jazzAccountId: me?.$jazz?.id || "Loading...",
              collectionsCount: collections.length,
              selectedCollection: selectedCollection || "None",
              metadata: metadata
                ? {
                    title: metadata.title?.substring(0, 50),
                    url: metadata.url?.substring(0, 50),
                    price: metadata.price,
                    platform: metadata.platform,
                  }
                : null,
            },
            null,
            2
          )}
        </pre>
      </details>
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

  const handleSuccess = () => {
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

console.log("[Tote] Popup script loading...");

try {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    console.error("[Tote] Root element not found!");
  } else {
    console.log("[Tote] Mounting React app...");
    const root = createRoot(rootElement);
    root.render(<App />);
    console.log("[Tote] React app mounted");
  }
} catch (err) {
  console.error("[Tote] Failed to mount app:", err);
}
