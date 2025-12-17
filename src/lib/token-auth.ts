/**
 * Token-based authentication for extension requests
 * Allows extension to authenticate using API tokens instead of Clerk sessions
 */

interface TokenInfo {
  userId: string;
  jazzAccountId: string;
  tokenId: string;
}

/**
 * Look up a user by their API token
 * This queries Clerk's user list to find which user owns the token
 * WARNING: This is inefficient for large user bases - should be replaced
 * with a dedicated token storage (database, Redis, etc.)
 */
export async function getUserByToken(token: string): Promise<TokenInfo | null> {
  try {
    if (!process.env.CLERK_SECRET_KEY) {
      console.error("[Token Auth] Missing CLERK_SECRET_KEY");
      return null;
    }

    if (!token) {
      return null;
    }

    console.log("[Token Auth] Searching for token in Clerk users...");

    // Fetch all users from Clerk and search for the token
    // This is a workaround - for production, use a token database
    const limit = 100;
    let offset = 0;
    let found: TokenInfo | null = null;

    while (true) {
      const response = await fetch(
        `https://api.clerk.com/v1/users?limit=${limit}&offset=${offset}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
          },
        }
      );

      if (!response.ok) {
        console.error("[Token Auth] Failed to fetch users:", response.status);
        break;
      }

      const users = await response.json();

      for (const user of users) {
        const tokens = user.private_metadata?.tokens || {};
        if (tokens[token]) {
          found = {
            userId: user.id,
            jazzAccountId: tokens[token].jazzAccountId,
            tokenId: tokens[token].id,
          };
          console.log("[Token Auth] Token found for user:", user.id);
          break;
        }
      }

      if (found || users.length < limit) {
        break;
      }

      offset += limit;
    }

    return found;
  } catch (error) {
    console.error("[Token Auth] Error looking up token:", error);
    return null;
  }
}

/**
 * Get user info from Clerk by token stored in private metadata
 * This searches for a token in a specific user's metadata
 * Used when we need to validate a token that we expect belongs to a specific user
 */
export async function validateUserToken(
  userId: string,
  token: string
): Promise<{
  valid: boolean;
  jazzAccountId?: string;
  tokenId?: string;
}> {
  try {
    if (!process.env.CLERK_SECRET_KEY) {
      return { valid: false };
    }

    // Fetch user from Clerk
    const response = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      },
    });

    if (!response.ok) {
      console.error("[Token Auth] Failed to fetch user:", response.status);
      return { valid: false };
    }

    const user = await response.json();
    const tokens = user.private_metadata?.tokens || {};

    if (tokens[token]) {
      return {
        valid: true,
        jazzAccountId: tokens[token].jazzAccountId,
        tokenId: tokens[token].id,
      };
    }

    return { valid: false };
  } catch (error) {
    console.error("[Token Auth] Error validating token:", error);
    return { valid: false };
  }
}
