"use client";

import { ClerkProvider, useClerk } from "@clerk/nextjs";
import { JazzInspector } from "jazz-tools/inspector";
import { JazzReactProviderWithClerk } from "jazz-tools/react";
import { apiKey } from "../apiKey";
import { OfflineBanner } from "../components/OfflineBanner";
import { ToastProvider } from "../components/ToastNotification";
import { JazzAccount } from "../schema";

function JazzProvider({ children }: { children: React.ReactNode }) {
	const clerk = useClerk();

	return (
		<JazzReactProviderWithClerk
			clerk={clerk}
			AccountSchema={JazzAccount}
			sync={{
				peer: `wss://cloud.jazz.tools/?key=${apiKey}`,
			}}
		>
			<ToastProvider>
				<OfflineBanner />
				{children}
				{process.env.NODE_ENV === "development" && <JazzInspector />}
			</ToastProvider>
		</JazzReactProviderWithClerk>
	);
}

export function Providers({ children }: { children: React.ReactNode }) {
	return (
		<ClerkProvider>
			<JazzProvider>{children}</JazzProvider>
		</ClerkProvider>
	);
}
