import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(), // Clerk user ID (user_xxxx)
  firstName: text('first_name'),
  lastName: text('last_name'),
  imageUrl: text('image_url').notNull(),
  primaryEmail: text('primary_email'),
  // UI language preference (see src/i18n/config.ts). NULL = never chosen;
  // clients fall back to cookie / Accept-Language / device language.
  locale: text('locale'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
