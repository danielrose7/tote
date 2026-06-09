import { eq, sql } from "drizzle-orm";
import { ablyOutbox } from "../schema";
import { dbTest, expect } from "../testing/vitest";

dbTest("stores connector-compatible realtime events", async ({ db }) => {
	const [event] = await db
		.insert(ablyOutbox)
		.values({
			mutationId: "50000000-0000-4000-8000-000000000100",
			channel: "collection:40000000-0000-4000-8000-000000000100",
			name: "collection.updated",
			data: {
				collectionId: "40000000-0000-4000-8000-000000000100",
				version: 2,
			},
		})
		.returning();

	expect(event).toMatchObject({
		rejected: false,
		lockedBy: null,
		lockExpiry: null,
		processed: false,
	});
	expect(event.sequenceId).toBeGreaterThan(0);

	const [stored] = await db
		.select()
		.from(ablyOutbox)
		.where(eq(ablyOutbox.sequenceId, event.sequenceId));
	expect(stored.data).toEqual({
		collectionId: "40000000-0000-4000-8000-000000000100",
		version: 2,
	});
});

dbTest(
	"installs the Ably statement-level notification trigger",
	async ({ db }) => {
		const result = (await db.execute(sql`
		SELECT
			trigger.tgname AS name,
			NOT trigger.tgisinternal AS enabled,
			pg_get_triggerdef(trigger.oid) AS definition
		FROM pg_trigger trigger
		WHERE trigger.tgrelid = 'public.ably_outbox'::regclass
			AND trigger.tgname = 'ably_outbox_notify_trigger'
	`)) as {
			rows: Array<{ name: string; enabled: boolean; definition: string }>;
		};

		expect(result.rows).toHaveLength(1);
		expect(result.rows[0]).toMatchObject({
			name: "ably_outbox_notify_trigger",
			enabled: true,
		});
		expect(result.rows[0].definition).toContain("FOR EACH STATEMENT");
		expect(result.rows[0].definition).toContain(
			"EXECUTE FUNCTION ably_outbox_notify()",
		);
	},
);
