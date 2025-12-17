# Jazz vs Clerk: How They Work Together

**Short Answer:** Jazz and Clerk serve different purposes. Jazz is the database, Clerk is the authentication provider. They can work together but don't have to.

---

## Current Architecture: Jazz Only

```
┌─────────────────────────────────────────────┐
│         User's Browser                      │
├─────────────────────────────────────────────┤
│  usePasskeyAuth() ──┐                       │
│      (Jazz auth)   │                        │
│                    ├──→ Jazz Passkey Flow   │
│  useAccount()  ────┤    (Sign-up/Login)    │
│   (Jazz client)    │                        │
└────────────┬───────┴────────────────────────┘
             │
             │ WebSocket
             ↓
    ┌─────────────────────┐
    │   Jazz Cloud        │
    │  (Database Sync)    │
    │                     │
    │ • AccountRoot       │
    │ • Collections       │
    │ • ProductLinks      │
    └─────────────────────┘
```

**What's happening:**
1. User opens app in browser
2. Jazz `usePasskeyAuth()` hook runs
3. User clicks "Sign Up" or "Log In"
4. Browser creates a passkey (WebAuthn)
5. Jazz stores account + passkey credential
6. Jazz syncs all data to cloud via WebSocket
7. All components use `useAccount()` to read/write data
8. Jazz handles real-time sync automatically

**Auth Flow:**
- ✅ Passkey-based (WebAuthn standard)
- ✅ Decentralized (no external auth server needed)
- ✅ Works offline (local storage, syncs later)
- ❌ Limited auth methods (only passkeys)
- ❌ No OAuth/social login options

---

## Future Architecture: Clerk + Jazz (Official Pattern)

Jazz has **built-in Clerk integration** via `<JazzReactProviderWithClerk />` component.

```
┌─────────────────────────────────────────────┐
│         User's Browser                      │
├─────────────────────────────────────────────┤
│  useAuth() (Clerk)  ──┐                     │
│   (OAuth/Passkey)    │                      │
│                      ├──→ Clerk Auth + Key  │
│  useAccount()  ──────┤    Storage Flow      │
│  (Jazz client)       │                      │
└────┬──────────────┬──────────────────────────┘
     │              │
     │ User ID      │ WebSocket + Keys
     ↓              ↓
 ┌──────────┐  ┌─────────────────────┐
 │  Clerk   │  │   Jazz Cloud        │
 │  (Auth)  │  │  (Database Sync)    │
 │          │  │                     │
 │ • Stores │  │ • User account keys │
 │   user   │  │ • AccountRoot       │
 │   keys   │  │ • Collections       │
 │ • OAuth  │  │ • ProductLinks      │
 │ • MFA    │  │ • Real-time sync    │
 └──────────┘  └─────────────────────┘
```

**Official Integration Pattern** (from Jazz docs):
```typescript
// Wrap app in both providers
<ClerkProvider>
  <JazzReactProviderWithClerk
    peer={/* peer config */}
    auth={clerkAuthInstance}
  >
    <YourApp />
  </JazzReactProviderWithClerk>
</ClerkProvider>
```

**What happens:**
1. Clerk handles sign-up/login (OAuth, email, MFA, passkey options)
2. User authenticates with Clerk
3. Jazz stores user account **keys** securely in Clerk
4. On login, Jazz retrieves keys from Clerk and restores account access
5. Once authenticated, users work **offline with full Jazz functionality**
6. Jazz syncs all data (collections, links) via peer-to-peer or cloud

**Auth Flow:**
- ✅ Multiple auth methods (Google, GitHub, Microsoft, email, passkey)
- ✅ Professional UX (user management dashboard)
- ✅ MFA support
- ✅ Offline-first after initial login (Jazz keys work offline)
- ✅ Official Jazz + Clerk integration (not custom glue code)
- ❌ Initial login requires internet (to retrieve keys from Clerk)
- ❌ External dependency (Clerk monthly cost)
- ⚠️ Adds complexity, but simpler than before

---

## Key Difference

| Aspect | Jazz | Clerk |
|--------|------|-------|
| **Purpose** | Database + real-time sync | Authentication only |
| **What it stores** | Collections, links, products | User credentials, sessions |
| **Auth Methods** | Passkeys (WebAuthn) only | OAuth, email, magic links, passkey |
| **Server** | Cloud.jazz.tools (WebSocket) | Clerk's servers |
| **Cost** | Free tier available | Paid (but generous free tier) |
| **Offline** | Works offline (syncs later) | Online only |
| **Extension Support** | Content script access | Clerk SDK available |

---

## Three Implementation Paths

### Path A: Jazz Only (CURRENT)

```typescript
// User authentication
const auth = usePasskeyAuth({ appName: "tote" });
await auth.signUp("");
await auth.logIn();

// Data access
const me = useAccount(JazzAccount, { resolve: { root: {...} } });
me.root?.links?.push(newLink);
```

**Pros:**
- Simple, self-contained
- Works offline
- No external dependencies
- Good for extension (passkey works in content script)

**Cons:**
- Only passkey auth
- No OAuth/social login
- Less familiar to users

**Timeline:** Ready now ✅

---

### Path B: Clerk + Jazz (RECOMMENDED for Production)

```typescript
// User authentication (Clerk)
const { isSignedIn, user, getToken } = useAuth();
const token = await getToken();

// Data access (Jazz with Clerk token)
const me = useAccount(JazzAccount, {
  resolve: { root: {...} },
  auth: { token } // ← Use Clerk token for auth
});

// API endpoint authentication
// POST /api/links/add requires Clerk token, validates against Clerk,
// then uses that to identify Jazz account owner
```

**Pros:**
- Professional auth (OAuth, MFA, user dashboard)
- Better extension UX (easy token generation)
- Still uses Jazz for data
- Industry standard (Clerk is widely used)

**Cons:**
- Additional setup (Clerk account, environment vars)
- Monthly cost ($0 free tier, then $25+/month)
- Migration path for existing passkey users

**Timeline:** 2-3 weeks to implement

---

### Path C: Support Both (HYBRID)

```typescript
// User can choose auth method
if (usePasskeyAuth || useClerk) {
  // Get user identity (either Jazz passkey or Clerk)
  // Link account to Jazz's AccountRoot
  // Continue using Jazz for data
}
```

**Pros:**
- Smooth migration path
- Existing passkey users not disrupted
- New users can use OAuth

**Cons:**
- Complex to implement
- Duplicate auth logic
- Need account linking UI

**Timeline:** 4+ weeks

---

## Extension Integration Implications

### Current (Jazz Passkey):

```
Extension ──→ Popup ──→ Content Script ──→ Generate Test Token ──→ API ──→ Jazz
                       (has page access)       (automatic)
```

**Simple:**
- Extension auto-generates token in popup
- No user interaction needed
- API validates token against Jazz

**Limitation:**
- Test tokens aren't "real" user tokens
- Can't tie to Clerk user ID

### With Clerk:

```
Extension ──→ Popup ──→ "Get Token" Link ──→ Browser Opens ──→ /auth/extension Page
                                              (with Clerk auth)

                                              ↓ User logs in with Clerk

                                              ↓ UI generates API token

                                              ↓ Token copied to extension

Extension ──→ API ──→ Verify Token ──→ Query Clerk User ID ──→ Find Jazz Account
```

**Better:**
- Real tokens tied to authenticated users
- Users can manage tokens in web UI
- Revocation/expiration support
- API can validate token AND user identity

**Complexity:**
- Requires redirect flow (extension → browser → back to extension)
- Token storage in extension
- Coordinate between Clerk auth and Jazz data

---

## Recommendation for Next Phase

### For Phase 2b (NOW): Stick with Jazz

**Reason:**
- Extension already has token storage working
- Can test end-to-end immediately
- Jazz auth is proven and works
- No need to add Clerk complexity yet

**What to do:**
1. Implement Jazz schema update (add ApiToken type)
2. Implement link creation in `/api/links/add`
3. Test extension ↔ API ↔ Jazz flow
4. **Don't add Clerk yet**

### For Future (v1.1+): Plan Clerk Migration

**Reason:**
- Once core functionality is solid, add OAuth
- Clerk makes it easy to invite users later
- Better UX for non-technical users
- Industry standard for managed auth

**What to plan:**
- Clerk project setup (free tier)
- Migration path for existing Jazz passkey users
- New users can choose between passkey and OAuth
- Hybrid auth until passkey users migrate

---

## How They'd Actually Connect (Official Jazz + Clerk)

Jazz has built-in support for Clerk, so integration is straightforward:

```typescript
// 1. Wrap providers (once in app setup)
<ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
  <JazzReactProviderWithClerk
    peer={process.env.NEXT_PUBLIC_JAZZ_PEER_URL}
    auth={clerkInstance}  // ← Jazz uses Clerk for auth
  >
    <YourApp />
  </JazzReactProviderWithClerk>
</ClerkProvider>

// 2. In components (works exactly the same)
const me = useAccount(JazzAccount, { resolve: { root: {...} } });
// Jazz automatically links to authenticated Clerk user
// No manual user ID mapping needed!

// 3. For API endpoints (on server)
import { auth } from "@clerk/nextjs/server";
const { userId } = await auth();
// userId identifies the Clerk user
// Jazz automatically associates their account/data with this userId
```

**Why it's simpler:**
- Jazz's Clerk integration handles the connection automatically
- Jazz stores account keys in Clerk (encrypted)
- On login, Jazz retrieves keys from Clerk
- All subsequent `useAccount()` calls use authenticated keys
- No manual bridging code needed

**Behind the scenes:**
1. User logs in via Clerk (OAuth/email/MFA)
2. Clerk creates session + user ID
3. Jazz receives that user ID from Clerk
4. Jazz retrieves this user's encrypted account keys from Clerk
5. Jazz decrypts keys locally (only user can decrypt)
6. All Jazz operations now use those keys (no server involvement)
7. Data stays private (server never sees unencrypted keys)

**For API endpoints:**
```typescript
export async function POST(request: Request) {
  const { userId } = await auth(); // Get Clerk user ID

  // Jazz automatically handles: userId → Jazz account
  // (because we used JazzReactProviderWithClerk)

  const account = await getJazzAccount(userId); // ← Jazz knows which account
  account.root?.links?.push(newLink);
  // ✅ Saved to right user's account
}
```

**Key insight:**
- **No manual user mapping needed!**
- Jazz + Clerk integration handles it automatically
- Clerk manages: "Who are you?" (OAuth, email, MFA)
- Jazz manages: "What's your data?" (sync, offline, real-time)
- They communicate through `JazzReactProviderWithClerk` component

---

## Summary Table

| Question | Answer |
|----------|--------|
| Do Jazz and Clerk conflict? | No, they're complementary |
| Can we use both? | Yes, Jazz for DB, Clerk for auth |
| Must we use Clerk? | No, Jazz passkey is production-ready |
| When should we add Clerk? | After extension MVP is working |
| What's needed to connect them? | User ID mapping (clerkUserId → accountId) |
| Will this break existing auth? | Not if we support both passkey + Clerk |
| Priority for Phase 2b? | **Keep Jazz only, plan Clerk for later** |

---

## Next Steps

### Immediate (Phase 2b):
1. Implement with Jazz only
2. Add ApiToken schema to AccountRoot
3. Implement link creation endpoint
4. Test extension saves to Jazz
5. **Don't touch Clerk yet**

### Later (v1.1+):
1. Create Clerk project
2. Add Clerk login to web app
3. Set up user ID mapping logic
4. Implement `/auth/extension` token generation
5. Migrate/support both auth methods

This keeps Phase 2b simple and focused while leaving room for Clerk later.
