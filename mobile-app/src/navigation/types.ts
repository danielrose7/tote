import { ID } from "jazz-tools";
import { Block } from "@tote/schema";

export type RootStackParamList = {
  CollectionList: undefined;
  CollectionDetail: { collectionId: ID<typeof Block>; collectionName: string };
  AccountSettings: undefined;
};
