import { auth, currentUser } from "@clerk/nextjs/server";
import { ImportPageClient } from "./ImportPageClient";
import styles from "./import.module.css";

export default async function ImportPage() {
	const { userId } = await auth();

	if (!userId) {
		return (
			<main className={styles.deniedMain}>
				<p>Sign in to access imports.</p>
			</main>
		);
	}

	const user = await currentUser();
	const canImport = user?.publicMetadata?.canImport === true;

	if (!canImport) {
		return (
			<main className={styles.deniedMain}>
				<p>Access restricted.</p>
			</main>
		);
	}

	return <ImportPageClient />;
}
