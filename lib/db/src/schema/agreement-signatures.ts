import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const agreementSignaturesTable = pgTable("agreement_signatures", {
  id: text("id").primaryKey(),
  agreementId: text("agreement_id").notNull(),
  driverProfileId: text("driver_profile_id").notNull(),
  userId: text("user_id").notNull(),
  agreementVersion: text("agreement_version").notNull(),
  signedAt: timestamp("signed_at", { withTimezone: true }).notNull(),
  legalName: text("legal_name").notNull(),
  signatureObjectPath: text("signature_object_path"),
  ipAddress: text("ip_address"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAgreementSignatureSchema = createInsertSchema(agreementSignaturesTable).omit({ createdAt: true, updatedAt: true });
export type InsertAgreementSignature = z.infer<typeof insertAgreementSignatureSchema>;
export type AgreementSignature = typeof agreementSignaturesTable.$inferSelect;
