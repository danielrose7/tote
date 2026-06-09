import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { canUseNeonCollections } from "../../../../lib/collections/api";
import {
	getAccountCollectionDataSource,
	getCollectionDetail,
} from "../../../../lib/collections/repository";
import { ClassicCollectionDetailPage } from "./ClassicCollectionDetailPage";
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

	const dataSource = await getAccountCollectionDataSource(userId);
	if (!canUseNeonCollections(dataSource)) {
		return <ClassicCollectionDetailPage />;
	}

	const { id } = await params;
	const detail = await getCollectionDetail(userId, id);
	if (!detail) {
		notFound();
	}

	return <NeonCollectionDetailPage detail={detail} />;
}
