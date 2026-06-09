import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const tempRoot = mkdtempSync(join(tmpdir(), "tote-postgres-integration-"));
const dataDirectory = join(tempRoot, "data");
const socketDirectory = join(tempRoot, "socket");
const logPath = join(tempRoot, "postgres.log");
const database = "tote_collections_test";
const port = 55_000 + Math.floor(Math.random() * 1_000);

function run(command, args, options = {}) {
	return execFileSync(command, args, {
		cwd: root,
		encoding: "utf8",
		stdio: "inherit",
		...options,
	});
}

function findCommand(command) {
	const result = spawnSync("sh", ["-c", `command -v ${command}`], {
		encoding: "utf8",
	});
	const path = result.stdout.trim();
	if (result.status !== 0 || !path) {
		throw new Error(
			`${command} is required. Install PostgreSQL 15 or newer to run database integration tests.`,
		);
	}
	return path;
}

const initdb = findCommand("initdb");
const pgCtl = findCommand("pg_ctl");
const createdb = findCommand("createdb");
const psql = findCommand("psql");
let started = false;

try {
	run(initdb, [
		"--auth=trust",
		"--encoding=UTF8",
		"--no-locale",
		"--username=postgres",
		"--pgdata",
		dataDirectory,
	]);

	run("mkdir", ["-p", socketDirectory]);
	run(pgCtl, [
		"-D",
		dataDirectory,
		"-l",
		logPath,
		"-o",
		`-F -p ${port} -k ${socketDirectory}`,
		"start",
		"-w",
	]);
	started = true;

	const connectionArgs = [
		"--host",
		socketDirectory,
		"--port",
		String(port),
		"--username",
		"postgres",
	];

	run(createdb, [...connectionArgs, database]);

	const migrations = readdirSync(join(root, "src/db/drizzle"))
		.filter((file) => /^\d+.*\.sql$/.test(file))
		.sort()
		.map((file) => `src/db/drizzle/${file}`);

	for (const migration of migrations) {
		run(psql, [
			...connectionArgs,
			"--dbname",
			database,
			"--set",
			"ON_ERROR_STOP=1",
			"--file",
			migration,
		]);
	}

	run(psql, [
		...connectionArgs,
		"--dbname",
		database,
		"--set",
		"ON_ERROR_STOP=1",
		"--file",
		"src/db/seeds/collections.integration.sql",
	]);

	run(psql, [
		...connectionArgs,
		"--dbname",
		database,
		"--set",
		"ON_ERROR_STOP=1",
		"--file",
		"src/db/integration/collections.sql",
	]);

	const pnpm = findCommand("pnpm");
	const testDatabaseUrl = `postgresql://postgres@127.0.0.1:${port}/${database}`;
	run(
		pnpm,
		["exec", "vitest", "run", "--config", "vitest.integration.config.ts"],
		{
			env: {
				...process.env,
				NEON_DB_POSTGRES_URL: testDatabaseUrl,
				TEST_DATABASE_URL: testDatabaseUrl,
			},
		},
	);

	console.log("[db:integration] collection schema checks passed");
} catch (error) {
	if (existsSync(logPath)) {
		console.error(`[db:integration] PostgreSQL log: ${logPath}`);
	}
	throw error;
} finally {
	if (started) {
		spawnSync(pgCtl, ["-D", dataDirectory, "stop", "-m", "immediate", "-w"], {
			stdio: "inherit",
		});
	}
	rmSync(tempRoot, { force: true, recursive: true });
}
