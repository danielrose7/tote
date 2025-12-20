/**
 * Background service worker for Tote extension
 *
 * With native Clerk + Jazz integration, the service worker is minimal.
 * Auth state is synced automatically via Clerk's Sync Host feature.
 */

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

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "save-to-tote" && tab?.id) {
    // Open the popup - this works because it's triggered by user gesture
    try {
      await chrome.action.openPopup();
    } catch (err) {
      // Fallback: If openPopup fails, show the user how to save
      console.log("[Tote] Could not open popup, showing notification");

      // Inject a small notification into the page
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Create and show a toast notification
          const toast = document.createElement("div");
          toast.textContent = "Click the Tote icon in your toolbar to save this page";
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
            animation: slideIn 0.3s ease;
          `;

          // Add animation keyframes
          const style = document.createElement("style");
          style.textContent = `
            @keyframes slideIn {
              from { transform: translateX(100%); opacity: 0; }
              to { transform: translateX(0); opacity: 1; }
            }
          `;
          document.head.appendChild(style);
          document.body.appendChild(toast);

          // Remove after 3 seconds
          setTimeout(() => {
            toast.style.animation = "slideIn 0.3s ease reverse";
            setTimeout(() => toast.remove(), 300);
          }, 3000);
        },
      });
    }
  }
});
