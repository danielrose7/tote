import type { Block } from "@tote/schema";
import type { ID } from "jazz-tools";

export type RootStackParamList = {
	CollectionList: { autoAdd?: boolean } | undefined;
	CollectionDetail: { collectionId: ID<typeof Block>; collectionName: string };
	AccountSettings: undefined;
};
