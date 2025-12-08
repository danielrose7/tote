# Navigation to Metadata Test Lab

The Metadata Test Lab is now easily accessible when running on localhost!

## 🚀 How to Access

### Option 1: Via Header Menu (Recommended)
When running on **localhost**, you'll see a **"🧪 Test Lab"** button in the header on every page.

```
┌─────────────────────────────────────────────┐
│ tote                           🧪 Test Lab │
│ Your product wishlist                       │
└─────────────────────────────────────────────┘
```

Click it from anywhere in the app to jump to the Test Lab!

### Option 2: Direct URL
Navigate directly to:
```
http://localhost:3000/dev/metadata-test
```

## 🎨 Visual Indicators

### Localhost-Only Display
- The **"🧪 Test Lab"** button only appears on `localhost` or `127.0.0.1`
- Styled with a purple dashed border to indicate it's a dev tool
- Will **NOT** appear in production

### Navigation Within Test Lab
Once in the Test Lab, you'll see:
- **"← Back to Collections"** link in the top-left to return to main app
- All the test tools and controls

## 🔒 Production Safety

The Test Lab menu:
- ✅ Only visible on localhost
- ✅ Automatically hidden in production
- ✅ No risk of exposure to users
- ✅ Safe to keep in codebase

## 📍 Menu Location

The dev menu appears in the header between the logo and action buttons:

```
[tote logo] [🧪 Test Lab] [+ Add Link] [+ Create Collection]
```

On mobile/narrow screens, it reflows appropriately with the responsive header layout.

## Quick Start

1. Start dev server:
   ```bash
   npm run dev
   ```

2. Open app:
   ```
   http://localhost:3000/collections
   ```

3. Look for **"🧪 Test Lab"** in header

4. Click to start testing metadata extraction!

## Navigation Flow

```
┌─────────────────┐
│   Collections   │ ← Main app
│  [🧪 Test Lab]  │ ← Click here
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Metadata Test   │ ← Test Lab
│ [← Back]        │ ← Return to app
└─────────────────┘
```

Easy navigation both ways!
