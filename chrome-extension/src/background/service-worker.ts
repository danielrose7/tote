// Background service worker for Tote extension
// Handles communication between popup and content scripts

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Tote] Extension installed");
});

// Optional: Add context menu for future "Save to Tote" on right-click
// chrome.contextMenus.create({
//   id: "save-to-tote",
//   title: "Save to Tote",
//   contexts: ["page", "link", "image"],
// });
