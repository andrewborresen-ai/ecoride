import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const driverProfilesTable = pgTable("driver_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  status: text("status").notNull().default("incomplete"),

  // Personal info
  firstName: text("first_name"),
  lastName: text("last_name"),
  dateOfBirth: text("date_of_birth"),
  idNumber: text("id_number"),
  phone: text("phone"),
  email: text("email"),

  // Address
  streetAddress: text("street_address"),
  suburb: text("suburb"),
  city: text("city"),
  province: text("province"),
  postalCode: text("postal_code"),

  // Banking
  bankName: text("bank_name"),
  accountNumber: text("account_number"),
  accountType: text("account_type"),
  branchCode: text("branch_code"),

  // Compliance
  boltDriverId: text("bolt_driver_id"),
  boltDeclarationAccepted: text("bolt_declaration_accepted").default("false"),
  boltDeclarationAcceptedAt: timestamp("bolt_declaration_accepted_at", { withTimezone: true }),

  // Fleet
  fleetType: text("fleet_type"),

  // Onboarding
  profileCompletedAt: timestamp("profile_completed_at", { withTimezone: true }),
  documentsCompletedAt: timestamp("documents_completed_at", { withTimezone: true }),
  agreementSignedAt: timestamp("agreement_signed_at", { withTimezone: true }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedBy: text("approved_by"),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  rejectedBy: text("rejected_by"),
  rejectionReason: text("rejection_reason"),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  suspendedBy: text("suspended_by"),
  suspensionReason: text("suspension_reason"),

  // Telematics
  telematicsDriverId: text("telematics_driver_id"),
  telematicsSyncStatus: text("telematics_sync_status").default("not_synced"),
  telematicsRegisteredAt: timestamp("telematics_registered_at", { withTimezone: true }),
  telematicsLastSyncedAt: timestamp("telematics_last_synced_at", { withTimezone: true }),
  telematicsSyncError: text("telematics_sync_error"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDriverProfileSchema = createInsertSchema(driverProfilesTable).omit({ createdAt: true, updatedAt: true });
export type InsertDriverProfile = z.infer<typeof insertDriverProfileSchema>;
export type DriverProfile = typeof driverProfilesTable.$inferSelect;
