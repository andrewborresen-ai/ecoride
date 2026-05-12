import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const vehicleAccessEventsTable = pgTable("vehicle_access_events", {
  id: text("id").primaryKey(),
  vehicleAssignmentId: text("vehicle_assignment_id").notNull(),
  vehicleId: text("vehicle_id").notNull(),
  driverProfileId: text("driver_profile_id").notNull(),
  userId: text("user_id").notNull(),
  eventType: text("event_type").notNull(),
  eventStatus: text("event_status").notNull().default("pending"),
  telematicsRequestId: text("telematics_request_id"),
  telematicsResponseCode: text("telematics_response_code"),
  telematicsResponseMessage: text("telematics_response_message"),
  biometricResult: text("biometric_result"),
  failureReason: text("failure_reason"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertVehicleAccessEventSchema = createInsertSchema(vehicleAccessEventsTable).omit({ createdAt: true, updatedAt: true });
export type InsertVehicleAccessEvent = z.infer<typeof insertVehicleAccessEventSchema>;
export type VehicleAccessEvent = typeof vehicleAccessEventsTable.$inferSelect;
