"use client";

import { ClerkProvider, useAuth, useClerk } from "@clerk/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { JazzInspector } from "jazz-tools/inspector";
import { JazzReactProviderWithClerk } from "jazz-tools/react";
import { useState } from "react";
import { apiKey } from "../apiKey";
import { OfflineBanner } from "../components/OfflineBanner";
import { ToastProvider } from "../components/ToastNotification";
import { JazzAccount } from "../schema";

const queryCacheDuration = 24 * 60 * 60 * 1_000;

function AccountQueryProvider({ children }: { children: React.ReactNode }) {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						gcTime: queryCacheDuration,
						staleTime: 30_000,
					},
					mutations: {
						networkMode: "offlineFirst",
					},
				},
			}),
	);

	return (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
}

function CollectionQueryProvider({ children }: { children: React.ReactNode }) {
	const { userId } = useAuth();
	return (
		<AccountQueryProvider key={userId ?? "unauthenticated"}>
			{children}
		</AccountQueryProvider>
	);
}

function JazzProvider({ children }: { children: React.ReactNode }) {
	const clerk = useClerk();
	const { userId } = useAuth();

	return (
		<JazzReactProviderWithClerk
			key={userId ?? "unauthenticated"}
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
			<CollectionQueryProvider>
				<JazzProvider>{children}</JazzProvider>
			</CollectionQueryProvider>
		</ClerkProvider>
	);
}
