import {
  SignedIn,
  SignedOut,
  useAuth,
  useClerk,
  useUser,
} from '@clerk/chrome-extension';
import {
  Component,
  type ErrorInfo,
  type ReactNode,
  useEffect,
  useState,
} from 'react';
import { createRoot } from 'react-dom/client';
import { purgeInactiveAccountData } from '../lib/captureStore';
import type {
  ExtractedMetadata,
  MessagePayload,
} from '../lib/extractors/types';
import { ExtensionProviders } from '../providers/ExtensionProviders';
import { SaveUI } from './SaveUI';

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
    console.error('[Tote] Error boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="popup">
          <div className="error">
            <strong>Error loading extension:</strong>
            <br />
            {this.state.error?.message || 'Unknown error'}
            <br />
            <small>Check console for details</small>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

type Status = 'loading' | 'ready' | 'saving' | 'success' | 'queued' | 'error';

function formatPrice(price?: string, currency?: string): string {
  if (!price) return '';
  const num = parseFloat(price);
  if (isNaN(num)) return price;

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  });
  return formatter.format(num);
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

import { uploadCapture } from '../lib/capture';

/**
 * Fire-and-forget: capture raw page data and upload to R2.
 */
async function captureTab(tabId: number): Promise<void> {
  try {
    const response: MessagePayload = await chrome.tabs.sendMessage(tabId, {
      type: 'CAPTURE_RAW_PAGE',
    } as MessagePayload);

    if (response?.capture) {
      await uploadCapture(response.capture);
    }
  } catch (err) {
    console.error('[Tote] Capture upload failed (non-blocking):', err);
  }
}

/**
 * Image picker - horizontal scrollable thumbnail row
 */
function ImagePicker({
  images,
  selected,
  onSelect,
}: {
  images: string[];
  selected: string;
  onSelect: (url: string) => void;
}) {
  if (images.length <= 1) return null;

  return (
    <div className="image-picker">
      {images.map((url) => (
        <img
          key={url}
          src={url}
          alt=""
          className={`image-picker-thumb${url === selected ? ' selected' : ''}`}
          onClick={() => onSelect(url)}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ))}
    </div>
  );
}

/**
 * Metadata preview component - shown regardless of auth state
 */
function MetadataPreview({
  metadata,
  selectedImageUrl,
  onImageSelect,
}: {
  metadata: ExtractedMetadata | null;
  selectedImageUrl: string | null;
  onImageSelect: (url: string) => void;
}) {
  if (!metadata) return null;

  const displayImage = selectedImageUrl || metadata.imageUrl;

  return (
    <div className="preview">
      {displayImage ? (
        <img
          src={displayImage}
          alt=""
          className="preview-image"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <div className="preview-image-placeholder">No image found</div>
      )}
      {metadata.images && (
        <ImagePicker
          images={metadata.images}
          selected={displayImage || ''}
          onSelect={onImageSelect}
        />
      )}
      <div className="preview-content">
        <div className="preview-title">{metadata.title || 'Untitled'}</div>
        <div className="preview-url">{getDomain(metadata.url)}</div>
        {metadata.price && (
          <div className="preview-price">
            {formatPrice(metadata.price, metadata.currency)}
          </div>
        )}
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
    chrome.tabs.create({ url: 'https://tote.tools/extension-auth' });
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
 * Header with user menu (sign out + save all tabs)
 */
function PopupHeader() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const enableSaveTabs = user?.publicMetadata?.enableSaveTabs === true;

  const handleSignOut = async () => {
    await signOut();
    setMenuOpen(false);
  };

  const handleSaveAllTabs = () => {
    chrome.tabs.create({ url: 'https://tote.tools/collections?saveTabs=1' });
    window.close();
  };

  return (
    <header className="header">
      <div className="header-left">
        <img src="/assets/icons/icon48.png" alt="" className="logo" />
        <h1>Save to Tote</h1>
      </div>
      <SignedIn>
        <div className="header-menu">
          <button
            className="header-avatar"
            onClick={() => setMenuOpen(!menuOpen)}
            title={user?.primaryEmailAddress?.emailAddress || 'Account'}
          >
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt="" className="header-avatar-img" />
            ) : (
              <span className="header-avatar-fallback">
                {(
                  user?.firstName?.[0] ||
                  user?.primaryEmailAddress?.emailAddress?.[0] ||
                  '?'
                ).toUpperCase()}
              </span>
            )}
          </button>
          {menuOpen && (
            <>
              <div
                className="header-menu-backdrop"
                onClick={() => setMenuOpen(false)}
              />
              <div className="header-dropdown">
                {enableSaveTabs && (
                  <button
                    className="header-dropdown-item"
                    onClick={handleSaveAllTabs}
                  >
                    Save All Tabs
                  </button>
                )}
                <button
                  className="header-dropdown-item header-dropdown-item--danger"
                  onClick={handleSignOut}
                >
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </SignedIn>
    </header>
  );
}

// Cached collections and queued captures are account data; drop them as soon
// as the popup observes a signed-out session.
function PurgeNeonCaptureData() {
  useEffect(() => {
    void purgeInactiveAccountData();
  }, []);
  return null;
}

function AuthenticatedSaveUI({
  metadata,
  onSuccess,
  onQueued,
}: {
  metadata: ExtractedMetadata;
  onSuccess: (collectionId: string) => void;
  onQueued: (collectionId: string) => void;
}) {
  const [unavailable, setUnavailable] = useState(false);

  if (unavailable) {
    return (
      <div className="error">
        Collections unavailable. Please try again later.
      </div>
    );
  }

  return (
    <SaveUI
      metadata={metadata}
      onSuccess={onSuccess}
      onQueued={onQueued}
      onUnavailable={() => setUnavailable(true)}
    />
  );
}

/**
 * Main popup content
 */
function PopupContent() {
  const [status, setStatus] = useState<Status>('loading');
  const [metadata, setMetadata] = useState<ExtractedMetadata | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedCollectionId, setSavedCollectionId] = useState<string | null>(
    null,
  );
  const { isLoaded } = useAuth();
  const { user } = useUser();

  const deepExtractEnabled = user?.publicMetadata?.enableDeepExtract === true;

  // Extract metadata from current tab
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) {
        setError('No active tab found');
        setStatus('error');
        return;
      }

      chrome.tabs.sendMessage(
        tab.id,
        { type: 'EXTRACT_METADATA' } as MessagePayload,
        (response: MessagePayload) => {
          if (chrome.runtime.lastError) {
            setError('Could not extract metadata. Try refreshing the page.');
            setStatus('error');
            return;
          }

          if (response?.error) {
            setError(response.error);
            setStatus('error');
            return;
          }

          if (response?.data) {
            setMetadata(response.data);
            setStatus('ready');

            // Fire-and-forget: capture raw page data for corpus
            if (deepExtractEnabled && tab.id) {
              captureTab(tab.id);
            }
          }
        },
      );
    });
  }, [deepExtractEnabled]);

  const handleSuccess = (collectionId: string) => {
    setSavedCollectionId(collectionId);
    setStatus('success');
  };

  const handleQueued = (collectionId: string) => {
    setSavedCollectionId(collectionId);
    setStatus('queued');
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
      <PopupHeader />

      {status === 'loading' && (
        <div className="loading">
          <div className="spinner" />
          <span>Extracting product info...</span>
        </div>
      )}

      {status === 'error' && (
        <div className="error">{error || 'Something went wrong'}</div>
      )}

      {status === 'success' && (
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

      {status === 'queued' && (
        <div className="success">
          <div className="success-icon">&#10003;</div>
          <h2>Saved offline</h2>
          <p>This product will sync the next time you're online.</p>
        </div>
      )}

      {status === 'ready' && metadata && (
        <>
          <MetadataPreview
            metadata={metadata}
            selectedImageUrl={selectedImageUrl}
            onImageSelect={setSelectedImageUrl}
          />

          <SignedOut>
            <PurgeNeonCaptureData />
            <SignInPrompt />
          </SignedOut>

          <SignedIn>
            <AuthenticatedSaveUI
              metadata={{
                ...metadata,
                imageUrl: selectedImageUrl || metadata.imageUrl,
              }}
              onSuccess={handleSuccess}
              onQueued={handleQueued}
            />
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

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}
