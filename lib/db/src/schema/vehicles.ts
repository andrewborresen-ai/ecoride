import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const vehiclesTable = pgTable("vehicles", {
  id: text("id").primaryKey(),
  registrationNumber: text("registration_number").notNull().unique(),
  make: text("make"),
  model: text("model"),
  year: text("year"),
  colour: text("colour"),
  vin: text("vin"),
  fleetType: text("fleet_type").notNull().default("electric"),
  telematicsVehicleId: text("telematics_vehicle_id"),
  telematicsEnabled: text("telematics_enabled").notNull().default("false"),
  telematicsSyncStatus: text("telematics_sync_status").default("not_synced"),
  telematicsLastSyncedAt: timestamp("telematics_last_synced_at", { withTimezone: true }),
  status: text("status").notNull().default("available"),
  notes: text("notes"),
  createdBy: text("created_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertVehicleSchema = createInsertSchema(vehiclesTable).omit({ createdAt: true, updatedAt: true });
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehiclesTable.$inferSelect;
