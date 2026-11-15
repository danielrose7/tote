import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		// Match tsconfig's "@/*" → "./src/*" so code using the alias is testable.
		alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
	},
	test: {
		exclude: ["src/db/integration/**/*.test.ts"],
		include: ["src/**/*.test.ts"],
	},
});
