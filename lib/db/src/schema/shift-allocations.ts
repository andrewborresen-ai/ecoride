import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const shiftAllocationsTable = pgTable("shift_allocations", {
  id: text("id").primaryKey(),
  shiftId: text("shift_id").notNull(),
  driverProfileId: text("driver_profile_id").notNull(),
  userId: text("user_id").notNull(),
  status: text("status").notNull().default("requested"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  confirmedBy: text("confirmed_by"),
  declinedAt: timestamp("declined_at", { withTimezone: true }),
  declinedBy: text("declined_by"),
  declineReason: text("decline_reason"),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertShiftAllocationSchema = createInsertSchema(shiftAllocationsTable).omit({ createdAt: true, updatedAt: true });
export type InsertShiftAllocation = z.infer<typeof insertShiftAllocationSchema>;
export type ShiftAllocation = typeof shiftAllocationsTable.$inferSelect;
