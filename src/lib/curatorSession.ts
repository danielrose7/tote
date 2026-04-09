/**
 * Curator session persistence helpers.
 *
 * Uses the `redis` package with KV_REDIS_URL (Vercel Redis / Upstash).
 * Falls back to the local session file when KV_REDIS_URL is not set.
 *
 * Only the completed result is persisted server-side — in-progress state lives
 * in the browser via Inngest Realtime + localStorage.
 */

import { createClient } from "redis";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface CuratorSessionData {
	phase?: "interview" | "planning" | "extracting" | "curating" | "complete" | "error";
	title?: string;
	sectionCount?: number;
	itemCount?: number;
	json?: string;
	urlSections?: { title: string; slug: string; urls: string[] }[];
}

export interface CuratorSessionResult extends CuratorSessionData {
	phase: "complete";
	title: string;
	sectionCount: number;
	itemCount: number;
	json: string;
}

let _redis: ReturnType<typeof createClient> | null = null;

async function getRedis() {
	if (!process.env.KV_REDIS_URL) return null;
	if (!_redis) {
		_redis = createClient({ url: process.env.KV_REDIS_URL });
		await _redis.connect();
	}
	return _redis;
}

export async function readSession(
	sessionId: string,
): Promise<CuratorSessionData | null> {
	const redis = await getRedis();

	if (redis) {
		const raw = await redis.get(`curate:session:${sessionId}`);
		if (!raw) return null;
		try {
			return JSON.parse(raw) as CuratorSessionData;
		} catch {
			return null;
		}
	}

	// Local dev fallback: read from the session file written by the Inngest function.
	try {
		const raw = await readFile(
			join(process.cwd(), "collections", ".sessions", `${sessionId}.json`),
			"utf-8",
		);
		const data = JSON.parse(raw);
		// Session file stores { urlSections, mock, phase?, result? }
		return {
			phase: data.phase ?? null,
			urlSections: data.urlSections ?? null,
			...(data.result ?? {}),
		};
	} catch {
		return null;
	}
}

export async function patchSession(
	sessionId: string,
	patch: Partial<CuratorSessionData>,
): Promise<void> {
	const redis = await getRedis();
	if (redis) {
		const existing = await readSession(sessionId) ?? {};
		await redis.set(
			`curate:session:${sessionId}`,
			JSON.stringify({ ...existing, ...patch }),
			{ EX: 60 * 60 * 24 * 30 },
		);
		return;
	}
	// Local dev: merge patch into the session file
	try {
		const path = join(process.cwd(), "collections", ".sessions", `${sessionId}.json`);
		let existing: Record<string, unknown> = {};
		try {
			existing = JSON.parse(await readFile(path, "utf-8"));
		} catch {
			// file doesn't exist yet
		}
		const { writeFile, mkdir } = await import("node:fs/promises");
		await mkdir(join(process.cwd(), "collections", ".sessions"), { recursive: true });
		await writeFile(path, JSON.stringify({ ...existing, ...patch }), "utf-8");
	} catch {
		// best-effort
	}
}

export async function writeSession(
	sessionId: string,
	result: CuratorSessionResult,
): Promise<void> {
	const redis = await getRedis();

	if (redis) {
		await redis.set(
			`curate:session:${sessionId}`,
			JSON.stringify(result),
			{ EX: 60 * 60 * 24 * 30 }, // 30 days
		);
		return;
	}

	// Local dev fallback: extend the existing session file.
	try {
		const path = join(
			process.cwd(),
			"collections",
			".sessions",
			`${sessionId}.json`,
		);
		let existing: Record<string, unknown> = {};
		try {
			existing = JSON.parse(await readFile(path, "utf-8"));
		} catch {
			// file doesn't exist yet
		}
		const { writeFile, mkdir } = await import("node:fs/promises");
		await mkdir(join(process.cwd(), "collections", ".sessions"), { recursive: true });
		await writeFile(path, JSON.stringify({ ...existing, result }), "utf-8");
	} catch {
		// best-effort
	}
}
