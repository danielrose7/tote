import { auth, currentUser } from "@clerk/nextjs/server";

export async function canUseChat(): Promise<boolean> {
	const { userId } = await auth();
	if (!userId) return false;

	const user = await currentUser();
	return user?.publicMetadata?.chatEnabled === true;
}
