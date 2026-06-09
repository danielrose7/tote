import { auth } from "@clerk/nextjs/server";
import {
	dehydrate,
	HydrationBoundary,
	QueryClient,
} from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { canUseNeonCollections } from "../../../lib/collections/api";
import { collectionQueryKeys } from "../../../lib/collections/queryKeys";
import {
	getAccountCollectionDataSource,
	listCollectionSummaries,
} from "../../../lib/collections/repository";
import { ClassicCollectionsPage } from "./ClassicCollectionsPage";
import { NeonCollectionsPage } from "./NeonCollectionsPage";

export default async function CollectionsPage() {
	const { userId } = await auth();
	if (!userId) {
		redirect("/");
	}

	const dataSource = await getAccountCollectionDataSource(userId);
	if (!canUseNeonCollections(dataSource)) {
		return <ClassicCollectionsPage />;
	}

	const collections = await listCollectionSummaries(userId);
	const queryClient = new QueryClient();
	queryClient.setQueryData(collectionQueryKeys.all, collections);

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<NeonCollectionsPage />
		</HydrationBoundary>
	);
}
