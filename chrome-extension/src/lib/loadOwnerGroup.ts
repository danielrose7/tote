import { Group } from "jazz-tools";
import type { co } from "jazz-tools";
import type { Block } from "@tote/schema";

type LoadedBlock = co.loaded<typeof Block>;

/**
 * Load the sharing group for a collection block.
 * Returns undefined if no sharingGroupId or if the group can't be loaded.
 */
export async function loadOwnerGroup(
  collection: LoadedBlock
): Promise<Group | undefined> {
  const sharingGroupId = collection.collectionData?.sharingGroupId;
  if (!sharingGroupId) return undefined;

  const group = await Group.load(sharingGroupId as `co_z${string}`, {});
  if (group && "$isLoaded" in group && group.$isLoaded) {
    return group as Group;
  }
  return undefined;
}
