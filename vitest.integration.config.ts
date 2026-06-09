import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		fileParallelism: false,
		include: ["src/db/integration/**/*.test.ts"],
		pool: "forks",
	},
});
