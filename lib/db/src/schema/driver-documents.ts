import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const driverDocumentsTable = pgTable("driver_documents", {
  id: text("id").primaryKey(),
  driverProfileId: text("driver_profile_id").notNull(),
  userId: text("user_id").notNull(),
  documentType: text("document_type").notNull(),
  objectPath: text("object_path").notNull(),
  fileName: text("file_name"),
  mimeType: text("mime_type"),
  fileSizeBytes: integer("file_size_bytes"),
  status: text("status").notNull().default("pending"),
  reviewNotes: text("review_notes"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDriverDocumentSchema = createInsertSchema(driverDocumentsTable).omit({ createdAt: true, updatedAt: true });
export type InsertDriverDocument = z.infer<typeof insertDriverDocumentSchema>;
export type DriverDocument = typeof driverDocumentsTable.$inferSelect;
