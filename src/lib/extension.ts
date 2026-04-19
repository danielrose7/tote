/**
 * Shared utilities for communicating with the Tote Chrome extension.
 */

export interface ExtractedMetadata {
  title?: string;
  description?: string;
  imageUrl?: string;
  price?: string;
}

export interface TabInfo {
  tabId: number;
  url: string;
  title: string;
  favIconUrl?: string;
  extractable: boolean;
}

// Extension ID - set via env var or hardcode after publishing
export const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID || '';

/**
 * Send a message to the extension and return the response.
 */
function sendExtensionMessage<T>(
  type: string,
  payload?: Record<string, unknown>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (
      !EXTENSION_ID ||
      typeof chrome === 'undefined' ||
      !chrome.runtime?.sendMessage
    ) {
      reject(new Error('Extension not available'));
      return;
    }

    chrome.runtime.sendMessage(
      EXTENSION_ID,
      { type, ...payload },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      },
    );
  });
}

/**
 * Check if the Tote extension is installed and responding.
 */
export async function checkExtensionAvailable(): Promise<boolean> {
  try {
    const response = await sendExtensionMessage<{ success: boolean }>('PING');
    return response?.success === true;
  } catch {
    return false;
  }
}

/**
 * Refresh a link by opening it in a background tab and extracting metadata.
 */
export async function refreshViaExtension(
  url: string,
  options?: { capture?: boolean },
): Promise<ExtractedMetadata | null> {
  try {
    const response = await sendExtensionMessage<{
      success: boolean;
      metadata?: ExtractedMetadata;
      error?: string;
    }>('REFRESH_LINK', { url, capture: options?.capture ?? false });

    if (response.success && response.metadata) {
      return response.metadata;
    }
    console.warn('[Tote] Extension refresh failed:', response.error);
    return null;
  } catch (error) {
    console.error('[Tote] Extension communication error:', error);
    return null;
  }
}

/**
 * Get all open tabs from the extension.
 */
export async function getAllTabs(): Promise<TabInfo[]> {
  const response = await sendExtensionMessage<{
    success: boolean;
    tabs?: TabInfo[];
    error?: string;
  }>('GET_ALL_TABS');

  if (response.success && response.tabs) {
    return response.tabs;
  }
  throw new Error(response.error || 'Failed to get tabs');
}

/**
 * Extract metadata from an already-open tab by its tab ID.
 */
export async function extractTabMetadata(
  tabId: number,
): Promise<ExtractedMetadata | null> {
  try {
    const response = await sendExtensionMessage<{
      success: boolean;
      metadata?: ExtractedMetadata;
      error?: string;
    }>('EXTRACT_TAB_METADATA', { tabId });

    if (response.success && response.metadata) {
      return response.metadata;
    }
    return null;
  } catch {
    return null;
  }
}
