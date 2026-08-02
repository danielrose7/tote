import { auth } from "@clerk/nextjs/server";
import {
	dehydrate,
	HydrationBoundary,
	QueryClient,
} from "@tanstack/react-query";
import { notFound, redirect } from "next/navigation";
import { collectionQueryKeys } from "@/lib/collections/queryKeys";
import { getCollectionDetail } from "@/lib/collections/repository";
import { NeonCollectionDetailPage } from "./NeonCollectionDetailPage";

export default async function CollectionDetailRoute({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { userId } = await auth();
	if (!userId) {
		redirect("/");
	}

	const { id } = await params;
	const detail = await getCollectionDetail(userId, id);
	if (!detail) {
		notFound();
	}

	const queryClient = new QueryClient();
	queryClient.setQueryData(collectionQueryKeys.detail(id), detail);

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<NeonCollectionDetailPage
				collectionId={id}
				realtimeEnabled={Boolean(process.env.ABLY_ROOT_KEY)}
			/>
		</HydrationBoundary>
	);
}
