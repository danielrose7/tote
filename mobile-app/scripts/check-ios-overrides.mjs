import fs from "node:fs/promises";
import path from "node:path";

const appRoot = path.resolve(import.meta.dirname, "..");
const overridesRoot = path.join(appRoot, "ios-overrides");
const iosRoot = path.join(appRoot, "ios");

async function walk(dir) {
	const entries = await fs.readdir(dir, { withFileTypes: true });
	const files = await Promise.all(
		entries.map(async (entry) => {
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) return walk(fullPath);
			return [fullPath];
		}),
	);

	return files.flat();
}

async function main() {
	try {
		await fs.access(overridesRoot);
	} catch {
		console.log("[ios-overrides] No overrides directory found, skipping.");
		return;
	}

	const files = await walk(overridesRoot);
	const mismatches = [];

	for (const sourcePath of files) {
		const relativePath = path.relative(overridesRoot, sourcePath);
		const targetPath = path.join(iosRoot, relativePath);
		const [sourceContents, targetContents] = await Promise.all([
			fs.readFile(sourcePath, "utf8"),
			fs.readFile(targetPath, "utf8").catch(() => null),
		]);

		if (targetContents !== sourceContents) {
			mismatches.push(relativePath);
		}
	}

	if (mismatches.length > 0) {
		console.error(
			"[ios-overrides] Generated iOS files drifted from overrides:",
		);
		for (const mismatch of mismatches) {
			console.error(`- ${mismatch}`);
		}
		process.exit(1);
	}

	console.log("[ios-overrides] All generated iOS overrides are in sync.");
}

await main();
