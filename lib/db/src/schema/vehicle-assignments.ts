import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const vehicleAssignmentsTable = pgTable("vehicle_assignments", {
  id: text("id").primaryKey(),
  vehicleId: text("vehicle_id").notNull(),
  driverProfileId: text("driver_profile_id").notNull(),
  userId: text("user_id").notNull(),
  shiftId: text("shift_id"),
  shiftAllocationId: text("shift_allocation_id"),
  assignmentStart: timestamp("assignment_start", { withTimezone: true }).notNull(),
  assignmentEnd: timestamp("assignment_end", { withTimezone: true }).notNull(),
  telematicsAssignmentId: text("telematics_assignment_id"),
  telematicsSyncStatus: text("telematics_sync_status").default("not_synced"),
  telematicsSyncedAt: timestamp("telematics_synced_at", { withTimezone: true }),
  telematicsSyncError: text("telematics_sync_error"),
  lastUnlockStatus: text("last_unlock_status"),
  lastUnlockAttemptAt: timestamp("last_unlock_attempt_at", { withTimezone: true }),
  status: text("status").notNull().default("active"),
  assignedBy: text("assigned_by"),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  endedBy: text("ended_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertVehicleAssignmentSchema = createInsertSchema(vehicleAssignmentsTable).omit({ createdAt: true, updatedAt: true });
export type InsertVehicleAssignment = z.infer<typeof insertVehicleAssignmentSchema>;
export type VehicleAssignment = typeof vehicleAssignmentsTable.$inferSelect;
