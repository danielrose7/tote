/**
 * App configuration
 * Values loaded from Expo environment variables
 */

export const CLERK_PUBLISHABLE_KEY =
	process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

export const JAZZ_API_KEY = process.env.EXPO_PUBLIC_JAZZ_API_KEY ?? "";
