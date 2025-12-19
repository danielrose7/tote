/**
 * Background service worker for Tote extension
 *
 * With native Clerk + Jazz integration, the service worker is minimal.
 * Auth state is synced automatically via Clerk's Sync Host feature.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Tote] Extension installed");
});

// Optional: Add context menu for future "Save to Tote" on right-click
// chrome.contextMenus.create({
//   id: "save-to-tote",
//   title: "Save to Tote",
//   contexts: ["page", "link", "image"],
// });
