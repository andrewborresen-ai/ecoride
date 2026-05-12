import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const shiftsTable = pgTable("shifts", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  fleetType: text("fleet_type"),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  capacity: integer("capacity").notNull().default(1),
  confirmedCount: integer("confirmed_count").notNull().default(0),
  status: text("status").notNull().default("open"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertShiftSchema = createInsertSchema(shiftsTable).omit({ createdAt: true, updatedAt: true });
export type InsertShift = z.infer<typeof insertShiftSchema>;
export type Shift = typeof shiftsTable.$inferSelect;
