import { ClerkLoaded, ClerkProvider } from "@clerk/expo";
import { CLERK_PUBLISHABLE_KEY } from "./config";
import { tokenCache } from "./tokenCache";

export function Providers({ children }: { children: React.ReactNode }) {
	return (
		<ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
			<ClerkLoaded>{children}</ClerkLoaded>
		</ClerkProvider>
	);
}
