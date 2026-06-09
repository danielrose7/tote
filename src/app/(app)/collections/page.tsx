import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { canUseNeonCollections } from "../../../lib/collections/api";
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
	return <NeonCollectionsPage collections={collections} />;
}
