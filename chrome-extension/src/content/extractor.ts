/**
 * Content script for extracting product metadata from web pages
 *
 * This script runs on all pages and listens for messages from the popup
 * to extract product information (title, price, image, etc.)
 */

import { extractMetadata } from "../lib/extractors";
import type { MessagePayload } from "../lib/extractors/types";

// Listen for messages from popup
chrome.runtime.onMessage.addListener(
  (
    message: MessagePayload,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessagePayload) => void
  ) => {
    if (message.type === "EXTRACT_METADATA") {
      try {
        const metadata = extractMetadata();
        console.log("[Tote] Extracted metadata:", metadata);
        sendResponse({
          type: "METADATA_RESULT",
          data: metadata,
        });
      } catch (error) {
        console.error("[Tote] Extraction error:", error);
        sendResponse({
          type: "METADATA_RESULT",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
    return true; // Keep channel open for async response
  }
);

console.log("[Tote] Content script loaded");
