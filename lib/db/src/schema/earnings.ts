import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const earningsTable = pgTable("earnings", {
  id: text("id").primaryKey(),
  driverProfileId: text("driver_profile_id").notNull(),
  userId: text("user_id").notNull(),
  shiftId: text("shift_id"),
  shiftAllocationId: text("shift_allocation_id"),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  currencyCode: text("currency_code").notNull().default("ZAR"),
  grossAmountCents: integer("gross_amount_cents").notNull().default(0),
  deductionsCents: integer("deductions_cents").notNull().default(0),
  incentivesCents: integer("incentives_cents").notNull().default(0),
  penaltiesCents: integer("penalties_cents").notNull().default(0),
  netAmountCents: integer("net_amount_cents").notNull().default(0),
  tripCount: integer("trip_count").notNull().default(0),
  notes: text("notes"),
  status: text("status").notNull().default("draft"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  publishedBy: text("published_by"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertEarningsSchema = createInsertSchema(earningsTable).omit({ createdAt: true, updatedAt: true });
export type InsertEarnings = z.infer<typeof insertEarningsSchema>;
export type Earnings = typeof earningsTable.$inferSelect;
