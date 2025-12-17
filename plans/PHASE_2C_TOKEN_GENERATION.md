# Phase 2c: Token Generation UI & Jazz Integration

**Status:** Ready to implement
**Prerequisite:** Phase 2b completed ✓ (Clerk auth setup complete)

---

## Current State

### Clerk Authentication ✓
- Clerk is integrated and working
- AuthButton uses Clerk components
- Middleware protects routes
- API routes can access userId via `auth()`

### API Endpoints ✓
- `POST /api/auth/verify-token` - Validates extension tokens (scaffold ready)
- `POST /api/links/add` - Accepts link data from extension (Clerk auth ready)
- Both have CORS enabled

### Jazz Schema ✓
- `ApiToken` type defined with: token, name, createdAt, lastUsedAt, isActive
- `AccountRoot.apiTokens: co.list(ApiToken)` added
- Migrations initialize apiTokens array

### Outstanding ⏳
- Token generation logic (create tokens, store in Jazz)
- `/auth/extension` page (UI for generating tokens)
- Jazz integration in `/api/links/add` (actually save links)

---

## Phase 2c Implementation Steps

### Step 1: Create Token Generation Endpoint

**File:** `app/api/auth/generate-token/route.ts` (NEW)

```typescript
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { useAccount } from "jazz-tools/react";
import { JazzAccount } from "@/src/schema";

export async function POST(request: Request) {
  try {
    // 1. Verify Clerk auth
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Get user's Jazz account
    // CHALLENGE: API routes are server-side, can't use useAccount()
    // SOLUTION: Need Jazz server access pattern
    //   - Query Jazz Co-Database for this user's account
    //   - Authenticate with Jazz API key (not user's passkey)
    //   - Create ApiToken record
    //   - Add to user's account.root.apiTokens

    // 3. Generate cryptographically secure token
    const token = generateSecureRandomToken(32);

    // 4. Create ApiToken record
    // const apiToken = await createApiToken({
    //   token,
    //   name: "Chrome Extension",
    //   createdAt: new Date(),
    //   isActive: true,
    // }, userJazzAccount);

    // 5. Return token (only in response, not stored plaintext)
    return NextResponse.json({
      token,
      message: "Token generated. Store this somewhere safe!",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to generate token" },
      { status: 500 }
    );
  }
}

function generateSecureRandomToken(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
}
```

**Challenge:** API routes run on server, can't use `useAccount()` React hook. Need Jazz server-side access pattern.

---

### Step 2: Create Token Generation UI Page

**File:** `app/auth/extension/page.tsx` (NEW)

```typescript
"use client";

import { useAuth } from "@clerk/nextjs";
import { useState } from "react";
import styles from "./extension-auth.module.css";

export default function ExtensionAuthPage() {
  const { isSignedIn } = useAuth();
  const [showToken, setShowToken] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isSignedIn) {
    return (
      <div className={styles.container}>
        <p>Please sign in to generate an extension token.</p>
      </div>
    );
  }

  const handleGenerateToken = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/generate-token", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to generate token");
      }

      const data = await response.json();
      setToken(data.token);
      setShowToken(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToken = async () => {
    if (token) {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={styles.container}>
      <h1>Chrome Extension Setup</h1>

      {showToken && token ? (
        <div className={styles.tokenDisplay}>
          <h2>Your API Token</h2>
          <p>Copy this token and paste it into your extension:</p>
          <code className={styles.tokenBox}>{token}</code>
          <button
            className={styles.copyButton}
            onClick={handleCopyToken}
            disabled={copied}
          >
            {copied ? "Copied!" : "Copy to Clipboard"}
          </button>
          <p className={styles.warning}>
            This is the only time you'll see this token. Store it safely!
          </p>
          <button
            className={styles.generateAgain}
            onClick={() => setShowToken(false)}
          >
            Generate New Token
          </button>
        </div>
      ) : (
        <div className={styles.generateSection}>
          <p>Generate an API token for your Chrome extension:</p>
          <button
            className={styles.generateButton}
            onClick={handleGenerateToken}
            disabled={loading}
          >
            {loading ? "Generating..." : "Generate Token"}
          </button>
          {error && <p className={styles.error}>{error}</p>}
        </div>
      )}
    </div>
  );
}
```

### Step 3: Update Extension to Use Real Tokens

**File:** `chrome-extension/src/popup/popup.tsx` (MODIFY)

Replace mock token generation with real token flow:

```typescript
// Remove: Auto-generated test tokens
// Add: Token input UI

const [tokenInput, setTokenInput] = useState("");
const [showTokenInput, setShowTokenInput] = useState(false);

useEffect(() => {
  // Check if token is already stored
  chrome.storage.local.get("authToken", (result) => {
    if (!result.authToken) {
      setShowTokenInput(true);
    }
  });
}, []);

const handleGetToken = () => {
  // Open /auth/extension page in new tab
  chrome.tabs.create({
    url: "http://localhost:3000/auth/extension"
  });
};

const handleSaveToken = async () => {
  if (!tokenInput.trim()) return;

  // Verify token with API
  try {
    const response = await fetch("http://localhost:3000/api/auth/verify-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: tokenInput }),
    });

    if (!response.ok) {
      throw new Error("Invalid token");
    }

    // Save token
    chrome.storage.local.set({ authToken: tokenInput });
    setShowTokenInput(false);
    setTokenInput("");
  } catch (err) {
    setError("Failed to verify token");
  }
};
```

---

### Step 4: Implement Jazz Integration in API

**File:** `app/api/links/add/route.ts` (MODIFY - Phase 2c)

This is the complex part. Currently the endpoint accepts links but doesn't save to Jazz.

**Challenge:** Server-side Jazz access

Need to figure out:
1. How to authenticate with Jazz from server-side (not via passkey)
2. How to create ProductLink objects in Jazz
3. How to add them to the correct collection

**Research needed:**
- Does Jazz have a server SDK?
- Can we use the API key to access user accounts?
- Is there a pattern for server-side Jazz operations?

**Placeholder implementation:**

```typescript
// app/api/links/add/route.ts

// TODO: Research Jazz server-side access patterns
// Pseudo-code for what we need:

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    // Step 1: Verify token in Jazz
    // const userAccount = await getJazzAccountByUserId(userId);
    // const tokenRecord = userAccount.root?.apiTokens?.find(t => t.token === authToken);
    // if (!tokenRecord?.isActive) return 401;

    // Step 2: Get collection
    // const collection = userAccount.root?.collections?.find(c => c.$jazz.id === collectionId);
    // if (!collection) return 404;

    // Step 3: Create ProductLink
    // const newLink = ProductLink.create({
    //   url: body.url,
    //   title: body.title,
    //   description: body.description,
    //   imageUrl: body.imageUrl,
    //   price: body.price,
    //   addedAt: new Date(),
    // }, userAccount.$jazz);

    // Step 4: Add to collection
    // collection.links.$jazz.push(newLink);

    // Step 5: Update lastUsedAt on token
    // tokenRecord.lastUsedAt = new Date();

    // For now, just log that we received the data
    console.log("[Extension Save] Would save to Jazz:", body);

    return NextResponse.json({
      success: true,
      linkId: `link_${Date.now()}`,
      // TODO: Update with actual linkId
    }, { status: 201 });
  } catch (error) {
    // ...
  }
}
```

---

## Critical Path to Complete Phase 2c

### Must Resolve
1. **Jazz Server-Side Access Pattern**
   - Research Jazz docs or code for server-side operations
   - Can we use Jazz API key to access user accounts?
   - Is there a REST API or server SDK?
   - How do other Jazz apps handle server-side writes?

### Implementation Order
1. Token generation endpoint (depends on Jazz server access)
2. Token generation UI page (straightforward React)
3. Extension token input (straightforward extension code)
4. Jazz integration in /api/links/add (depends on server access)

### Testing Strategy
1. Generate token via UI
2. Enter token in extension
3. Verify token endpoint accepts it
4. Save link from extension
5. Check Jazz dev tools for persisted link

---

## Key Files & Locations

### New Files
- `app/api/auth/generate-token/route.ts`
- `app/auth/extension/page.tsx`
- `app/auth/extension/extension-auth.module.css`

### Modified Files
- `chrome-extension/src/popup/popup.tsx` - Token UI
- `app/api/links/add/route.ts` - Jazz integration
- `app/api/auth/verify-token/route.ts` - Already created

### Reference
- Schema: `src/schema.ts` - ApiToken, AccountRoot.apiTokens
- Extension auth storage: chrome.storage.local.get/set("authToken")
- Clerk auth: `import { auth } from "@clerk/nextjs/server"`

---

## Research Notes

### Jazz Server Access
- **Question:** How do we access Jazz Co-Values from Next.js API routes?
- **Current:** JazzReactProvider + useAccount() work in components
- **Needed:** Server-side equivalent or REST API pattern

**Possible solutions:**
1. Jazz REST API endpoint (lookup in docs)
2. Jazz server SDK (if it exists)
3. Create account credentials for server access
4. Use existing account's encryption key
5. Store token→accountId mapping in separate database

### Token Generation Approach
- **One-way generation:** Generate token, return once, store hashed
- **Two-way verification:** Store plaintext in Jazz, verify on API calls
- **JWT approach:** Sign token as JWT, verify signature

**Recommendation:** Two-way for MVP (simpler), migrate to hashed later

---

## Estimated Effort

| Task | Effort | Blocker |
|------|--------|---------|
| Token generation endpoint | 4 hrs | Jazz server access |
| Token generation UI | 2 hrs | None |
| Extension UI update | 2 hrs | None |
| Jazz integration | 6 hrs | Jazz server access |
| Testing | 2 hrs | None |
| **Total** | **16 hrs** | **Jazz server access** |

**Blocker:** Must resolve Jazz server-side access pattern first before proceeding with actual implementation.

---

## Resume Instructions

### To continue Phase 2c:

1. **Research Jazz server access:**
   ```
   - Read Jazz docs for server-side operations
   - Check if there's a Co-Database REST API
   - Look for server SDK or examples in codebase
   ```

2. **Once resolved, implement:**
   ```
   - Token generation endpoint
   - Token generation UI
   - Extension token input
   - Jazz integration in /api/links/add
   ```

3. **Test flow:**
   ```
   - Log in to app (Clerk auth)
   - Visit /auth/extension
   - Generate token
   - Paste into extension
   - Save product from extension
   - Verify link in Jazz dev tools
   ```

### Environment
- Clerk configured: ✓
- Jazz real API key: ✓
- Dev server: `pnpm dev` on port 3000
- Extension: Built in `chrome-extension/dist`

### Current Logs
- Token validation test: `/api/auth/verify-token` ready
- Link save test: `/api/links/add` logs received data
- Watch: `pnpm dev` output for `[Extension Save]` logs
