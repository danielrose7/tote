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

async function ensureDir(filePath) {
	await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function main() {
	try {
		await fs.access(overridesRoot);
	} catch {
		console.log("[ios-overrides] No overrides directory found, skipping.");
		return;
	}

	const files = await walk(overridesRoot);

	for (const sourcePath of files) {
		const relativePath = path.relative(overridesRoot, sourcePath);
		const targetPath = path.join(iosRoot, relativePath);
		await ensureDir(targetPath);
		await fs.copyFile(sourcePath, targetPath);
		console.log(`[ios-overrides] synced ${relativePath}`);
	}
}

await main();
