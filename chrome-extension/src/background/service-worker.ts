// Background service worker for Tote extension
// Handles communication between popup and content scripts

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Tote] Extension installed");
});

// Listen for messages from the web app (e.g., token generation)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[Tote] Received message:", message.type);

  if (message.type === "STORE_TOKEN") {
    // Store the token in extension storage
    const token = message.token;
    chrome.storage.local.set({ authToken: token }, () => {
      console.log("[Tote] Token stored in extension storage");
      sendResponse({ success: true, message: "Token stored" });
    });
    return true; // Keep the message channel open for async response
  }

  sendResponse({ error: "Unknown message type" });
});

// Optional: Add context menu for future "Save to Tote" on right-click
// chrome.contextMenus.create({
//   id: "save-to-tote",
//   title: "Save to Tote",
//   contexts: ["page", "link", "image"],
// });
