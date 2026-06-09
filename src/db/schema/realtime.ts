import {
	boolean,
	jsonb,
	pgTable,
	serial,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

export const ablyNodes = pgTable("ably_nodes", {
	id: text("id").primaryKey(),
	expiry: timestamp("expiry", { withTimezone: false }).notNull(),
});

export const ablyOutbox = pgTable("ably_outbox", {
	sequenceId: serial("sequence_id").primaryKey(),
	mutationId: text("mutation_id").notNull(),
	channel: text("channel").notNull(),
	name: text("name").notNull(),
	rejected: boolean("rejected").notNull().default(false),
	data: jsonb("data").$type<Record<string, unknown>>(),
	headers: jsonb("headers").$type<Record<string, unknown>>(),
	lockedBy: text("locked_by"),
	lockExpiry: timestamp("lock_expiry", { withTimezone: false }),
	processed: boolean("processed").notNull().default(false),
});

export type AblyOutboxEvent = typeof ablyOutbox.$inferSelect;
