# Chrome Web Store Listing — Tote

## Store Description

Tote is a universal shopping cart that works across every online store. Save products from any website with one click, and keep everything organized in one place.

**How it works:**
- Browse any online store and click the Tote extension icon to save a product
- Tote automatically extracts the title, image, price, and brand
- Organize your saved items into collections — by project, season, gift list, or however you like
- Right-click any page or link and choose "Save to Tote" for even faster saving
- Refresh saved products to see updated prices

**Privacy-first by design:**
Tote collects only the metadata you explicitly choose to save — no tracking, no analytics, no browsing history, no ads. Your data is synced with end-to-end encryption using Jazz, a local-first sync engine. You own your data.

**Features:**
- Save from any website with one click
- Automatic metadata extraction (title, image, price, brand)
- Organize products into collections
- Price refresh to see current prices
- Syncs across devices with end-to-end encryption
- Works offline — local-first architecture

Built by Bloom Interactive LLC (https://gobloom.io)

---

## Permission Justifications

| Permission | Justification |
|---|---|
| `<all_urls>` (host permission + content script) | Tote extracts product metadata (title, image, price) from any shopping website. The content script must run on all URLs because users shop across thousands of different domains. Metadata is only extracted when the user explicitly clicks "Save to Tote" — the script does not collect or transmit any data in the background. |
| `tabs` | Used to identify the active tab's URL and title when saving a product. Also used to open background tabs for the "refresh price" feature, which re-visits a previously saved product page to extract updated metadata. |
| `activeTab` | Used to send messages to the content script running on the active tab when the user clicks the extension icon or uses the context menu. |
| `storage` | Persists authentication tokens and user preferences (such as the last-used collection) locally in the browser. No sensitive user data is stored — only session tokens and UI state. |
| `cookies` | Required by the Clerk authentication SDK for session management. Clerk uses cookies to sync authentication state between the extension and the tote.tools web app. |
| `contextMenus` | Provides a right-click "Save to Tote" menu item on pages and links, giving users a faster way to save products without opening the extension popup. |
| `scripting` | Used to inject a brief toast notification on the page after a product is saved via the context menu, confirming the save action to the user. No persistent scripts are injected. |

---

## CWS Privacy Practices Tab

### Single Purpose Description

Tote saves product information from online stores into organized collections. Users click the extension icon or right-click to save a product's metadata (title, image, price, brand) from the current page. The extension provides a popup UI to preview the extracted data, select a collection, and save.

### Data Use Disclosures

**Do you collect or transmit user data?**
Yes — only the specific product metadata the user explicitly chooses to save (page title, description, image URL, price, currency, brand, page URL). This data is transmitted over HTTPS to Jazz sync servers using end-to-end encryption.

**What user data do you collect?**
- Website content: Page title, meta description, product image URL, price, currency, brand name, and page URL — extracted only when the user clicks "Save to Tote"
- Authentication data: Email address and account information, handled by Clerk (third-party auth provider)

**What do you do with the collected data?**
- Provide the core functionality of saving and organizing products
- Sync saved products across the user's devices via Jazz (end-to-end encrypted)
- Authenticate the user via Clerk

**Do you sell user data?**
No.

**Do you use or transfer user data for purposes unrelated to the extension's single purpose?**
No.

**Do you use or transfer user data to determine creditworthiness or for lending purposes?**
No.

### Remote Code Policy

**Does your extension execute remote code?**
No. All code is bundled in the extension package. No remote JavaScript is fetched or executed.

---

## Category

Shopping

## Support Email

support@gobloom.io
