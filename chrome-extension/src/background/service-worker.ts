/**
 * Background service worker for Tote extension
 *
 * With native Clerk + Jazz integration, the service worker is minimal.
 * Auth state is synced automatically via Clerk's Sync Host feature.
 */

import type { ExtractedMetadata, MessagePayload } from "../lib/extractors/types";

// Handle messages from the web app (externally_connectable)
chrome.runtime.onMessageExternal.addListener(
  (message, sender, sendResponse) => {
    console.log("[Tote] External message received:", message, "from:", sender.origin);

    if (message.type === "PING") {
      // Simple ping to check if extension is installed
      sendResponse({ success: true, version: chrome.runtime.getManifest().version });
      return true;
    }

    if (message.type === "REFRESH_LINK") {
      // Extract metadata from a URL by opening it in a background tab
      handleRefreshLink(message.url)
        .then((metadata) => sendResponse({ success: true, metadata }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true; // Keep channel open for async response
    }

    return false;
  }
);

// Open a URL in a background tab, extract metadata, then close the tab
async function handleRefreshLink(url: string): Promise<ExtractedMetadata> {
  console.log("[Tote] Refreshing link:", url);

  // Open tab in background
  const tab = await chrome.tabs.create({
    url,
    active: false, // Background tab
  });

  if (!tab.id) {
    throw new Error("Failed to create tab");
  }

  const tabId = tab.id;

  try {
    // Wait for page to load
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error("Page load timeout"));
      }, 15000);

      const listener = (
        updatedTabId: number,
        changeInfo: chrome.tabs.TabChangeInfo
      ) => {
        if (updatedTabId === tabId && changeInfo.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          clearTimeout(timeout);
          resolve();
        }
      };

      chrome.tabs.onUpdated.addListener(listener);
    });

    // Small delay for content script to be ready
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Request metadata from content script
    const response = await chrome.tabs.sendMessage(tabId, {
      type: "EXTRACT_METADATA",
    } as MessagePayload);

    if (response?.error) {
      throw new Error(response.error);
    }

    if (!response?.data) {
      throw new Error("No metadata extracted");
    }

    return response.data;
  } finally {
    // Always close the tab
    try {
      await chrome.tabs.remove(tabId);
    } catch {
      // Tab may already be closed
    }
  }
}

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  console.log("[Tote] Extension installed");

  // Create right-click context menu
  chrome.contextMenus.create({
    id: "save-to-tote",
    title: "Save to Tote",
    contexts: ["page", "link"],
  });
});

// Show a toast notification on the page
function showToast(tabId: number, message: string) {
  chrome.scripting.executeScript({
    target: { tabId },
    func: (msg: string) => {
      const toast = document.createElement("div");
      toast.textContent = msg;
      toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #6366f1;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: system-ui, sans-serif;
        font-size: 14px;
        z-index: 999999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: toteSlideIn 0.3s ease;
      `;

      const style = document.createElement("style");
      style.textContent = `
        @keyframes toteSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
      document.body.appendChild(toast);

      setTimeout(() => {
        toast.style.animation = "toteSlideIn 0.3s ease reverse";
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    },
    args: [message],
  });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "save-to-tote" || !tab?.id) return;

  // If right-clicked on a link, open that page first
  if (info.linkUrl) {
    console.log("[Tote] Opening linked page:", info.linkUrl);

    // Open the link in a new tab
    const newTab = await chrome.tabs.create({
      url: info.linkUrl,
      active: true,
    });

    if (!newTab.id) return;

    // Wait for the page to finish loading, then open popup
    const listener = async (
      tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo
    ) => {
      if (tabId === newTab.id && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);

        // Small delay to ensure content script is injected
        await new Promise((resolve) => setTimeout(resolve, 500));

        try {
          await chrome.action.openPopup();
        } catch (err) {
          console.log("[Tote] Could not open popup:", err);
          showToast(
            tabId,
            "Click the Tote icon in your toolbar to save this page"
          );
        }
      }
    };

    chrome.tabs.onUpdated.addListener(listener);

    // Timeout after 10 seconds
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
    }, 10000);

    return;
  }

  // Right-clicked on the page itself - just open popup
  try {
    await chrome.action.openPopup();
  } catch (err) {
    console.log("[Tote] Could not open popup, showing notification");
    showToast(tab.id, "Click the Tote icon in your toolbar to save this page");
  }
});
