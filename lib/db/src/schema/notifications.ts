import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const notificationsTable = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  type: text("type").notNull().default("general"),
  referenceType: text("reference_type"),
  referenceId: text("reference_id"),
  status: text("status").notNull().default("unread"),
  readAt: timestamp("read_at", { withTimezone: true }),
  sentBy: text("sent_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ createdAt: true, updatedAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;
