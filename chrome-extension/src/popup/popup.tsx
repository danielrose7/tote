import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { ExtractedMetadata, MessagePayload } from "../lib/extractors/types";

interface Collection {
  id: string;
  name: string;
  color: string;
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

function Popup() {
  const [status, setStatus] = useState<Status>("loading");
  const [metadata, setMetadata] = useState<ExtractedMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>("");
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Fetch collections from the API
  const fetchCollections = async (token: string) => {
    try {
      console.log("[Tote] Fetching collections...");
      const response = await fetch("http://localhost:3000/api/collections/list", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("[Tote] Collections fetched:", data);
        if (data.collections && data.collections.length > 0) {
          setCollections(data.collections);
          // Set default to first collection
          setSelectedCollection(data.collections[0].id);
        } else {
          setError("No collections found. Please create a collection first.");
        }
      } else if (response.status === 401) {
        setError("Not authenticated. Please generate a token on /auth/extension");
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to fetch collections");
      }
    } catch (err) {
      console.error("[Tote] Error fetching collections:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch collections"
      );
    }
  };

  useEffect(() => {
    const initializePopup = async () => {
      // Get auth token from chrome storage
      const result = await new Promise<{ authToken?: string }>((resolve) => {
        chrome.storage.local.get("authToken", resolve);
      });

      let token = result.authToken;

      if (!token) {
        // User needs to generate a token
        setError(
          "No auth token found. Please visit http://localhost:3000/auth/extension to generate one."
        );
        setStatus("error");
        return;
      }

      await proceedWithToken(token);
    };

    // Helper function to proceed with token
    const proceedWithToken = async (token: string) => {
      setAuthToken(token);

      // Fetch collections
      await fetchCollections(token);

      // Get active tab and request metadata extraction
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab?.id) {
          setError("No active tab found");
          setStatus("error");
          return;
        }

        // Send message to content script
        chrome.tabs.sendMessage(
          tab.id,
          { type: "EXTRACT_METADATA" } as MessagePayload,
          (response: MessagePayload) => {
            if (chrome.runtime.lastError) {
              // Content script might not be loaded yet
              setError(
                "Could not extract metadata. Try refreshing the page."
              );
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
    };

    initializePopup();
  }, []);

  const handleSave = async () => {
    if (!metadata) return;

    setStatus("saving");
    setError(null);

    try {
      // Get auth token from chrome storage
      const { authToken } = await new Promise<{ authToken?: string }>(
        (resolve) => {
          chrome.storage.local.get("authToken", resolve);
        }
      );

      if (!authToken) {
        setError("Auth token not found. Please configure the extension.");
        setStatus("error");
        return;
      }

      // Call the API endpoint
      const response = await fetch("http://localhost:3000/api/links/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          url: metadata.url,
          title: metadata.title,
          description: metadata.description,
          imageUrl: metadata.imageUrl,
          price: metadata.price,
          currency: metadata.currency,
          collectionId: selectedCollection,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `API error: ${response.statusText}`
        );
      }

      const result = await response.json();
      console.log("[Tote] Link saved:", result);
      setStatus("success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save link";
      setError(message);
      setStatus("error");
      console.error("[Tote] Save error:", err);
    }
  };

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
        <div className="error">
          {error || "Something went wrong"}
        </div>
      )}

      {status === "success" && (
        <div className="success">
          <div className="success-icon">✓</div>
          <h2>Saved to Tote!</h2>
          <p>
            Added to{" "}
            {collections.find((c) => c.id === selectedCollection)?.name ||
              "collection"}
          </p>
        </div>
      )}

      {(status === "ready" || status === "saving") && metadata && (
        <>
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
              <div className="preview-title">
                {metadata.title || "Untitled"}
              </div>
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
                {metadata.brand && (
                  <span className="meta-tag">{metadata.brand}</span>
                )}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="collection">Collection</label>
            <select
              id="collection"
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
              disabled={collections.length === 0}
            >
              {collections.length === 0 ? (
                <option disabled value="">
                  No collections available
                </option>
              ) : (
                collections.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <button
            className="save-button"
            onClick={handleSave}
            disabled={status === "saving"}
          >
            {status === "saving" ? "Saving..." : "Save to Tote"}
          </button>

          <details className="debug">
            <summary>Debug Info</summary>
            <pre>{JSON.stringify({
              authToken: authToken ? `${authToken.substring(0, 8)}...${authToken.substring(authToken.length - 8)}` : "Not found",
              collectionsCount: collections.length,
              selectedCollection,
              metadata
            }, null, 2)}</pre>
          </details>
        </>
      )}
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<Popup />);
