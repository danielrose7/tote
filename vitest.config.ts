import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		exclude: ["src/db/integration/**/*.test.ts"],
		include: ["src/**/*.test.ts"],
	},
});
