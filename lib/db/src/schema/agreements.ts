import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const agreementsTable = pgTable("agreements", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  version: text("version").notNull(),
  content: text("content").notNull(),
  fleetType: text("fleet_type"),
  status: text("status").notNull().default("draft"),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  activatedBy: text("activated_by"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAgreementSchema = createInsertSchema(agreementsTable).omit({ createdAt: true, updatedAt: true });
export type InsertAgreement = z.infer<typeof insertAgreementSchema>;
export type Agreement = typeof agreementsTable.$inferSelect;
