import { Router, type IRouter } from "express";
import { db, driverProfilesTable, usersTable, driverDocumentsTable } from "@workspace/db";
import { eq, and, ilike, or, isNull } from "drizzle-orm";
import { requireAdmin } from "../../middlewares/auth";
import type { AuthenticatedRequest } from "../../middlewares/auth";
import { ok } from "../../lib/response";
import * as telematics from "../../integrations/telematics";
import { notificationsTable } from "@workspace/db";
import { newId } from "../../lib/ids";

const router: IRouter = Router();

router.get("/v1/admin/drivers", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  let query = db.select().from(driverProfilesTable).$dynamic();

  if (req.query.status) {
    query = query.where(eq(driverProfilesTable.status, req.query.status as string));
  }

  const profiles = await query;
  res.json(ok(profiles, { total: profiles.length }));
});

router.get("/v1/admin/drivers/:driverId", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.driverId) ? req.params.driverId[0] : req.params.driverId;

  const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.id, raw));
  if (!profile) {
    res.status(404).json({ success: false, error: "Driver not found", data: null, meta: null });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, profile.userId));
  const docs = await db.select().from(driverDocumentsTable).where(and(eq(driverDocumentsTable.driverProfileId, raw), isNull(driverDocumentsTable.deletedAt)));

  res.json(ok({ profile, user: user ?? null, documents: docs }));
});

router.post("/v1/admin/drivers/:driverId/approve", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.driverId) ? req.params.driverId[0] : req.params.driverId;

  const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.id, raw));
  if (!profile) {
    res.status(404).json({ success: false, error: "Driver not found", data: null, meta: null });
    return;
  }

  const now = new Date();
  const [updated] = await db
    .update(driverProfilesTable)
    .set({ status: "approved", approvedAt: now, approvedBy: req.userId! })
    .where(eq(driverProfilesTable.id, raw))
    .returning();

  // Trigger telematics registration in background (non-blocking)
  if (!profile.telematicsDriverId) {
    telematics.registerDriver({
      driverProfileId: profile.id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      idNumber: profile.idNumber,
      phone: profile.phone,
    }).then(async (result) => {
      if (result.success && result.telematicsDriverId) {
        await db
          .update(driverProfilesTable)
          .set({
            telematicsDriverId: result.telematicsDriverId,
            telematicsSyncStatus: "synced",
            telematicsRegisteredAt: new Date(),
          })
          .where(eq(driverProfilesTable.id, raw));
        req.log.info({ driverProfileId: raw, telematicsDriverId: result.telematicsDriverId }, "Driver registered with telematics");
      } else {
        await db
          .update(driverProfilesTable)
          .set({ telematicsSyncStatus: "failed", telematicsSyncError: result.error ?? "unknown" })
          .where(eq(driverProfilesTable.id, raw));
        req.log.warn({ driverProfileId: raw, error: result.error }, "Telematics driver registration failed");
      }
    });
  }

  // Send approval notification
  await db.insert(notificationsTable).values({
    id: newId(),
    userId: profile.userId,
    title: "Application Approved",
    body: "Your EcoRide driver application has been approved. Welcome aboard!",
    type: "application_approved",
    status: "unread",
    sentBy: req.userId!,
  });

  req.log.info({ driverProfileId: raw, approvedBy: req.userId }, "Driver approved");
  res.json(ok(updated));
});

router.post("/v1/admin/drivers/:driverId/reject", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.driverId) ? req.params.driverId[0] : req.params.driverId;

  const { reason } = req.body;
  if (!reason) {
    res.status(400).json({ success: false, error: "reason is required", data: null, meta: null });
    return;
  }

  const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.id, raw));
  if (!profile) {
    res.status(404).json({ success: false, error: "Driver not found", data: null, meta: null });
    return;
  }

  const [updated] = await db
    .update(driverProfilesTable)
    .set({ status: "rejected", rejectedAt: new Date(), rejectedBy: req.userId!, rejectionReason: reason })
    .where(eq(driverProfilesTable.id, raw))
    .returning();

  await db.insert(notificationsTable).values({
    id: newId(),
    userId: profile.userId,
    title: "Application Update",
    body: `Your application could not be approved at this time. Reason: ${reason}`,
    type: "application_rejected",
    status: "unread",
    sentBy: req.userId!,
  });

  req.log.info({ driverProfileId: raw }, "Driver rejected");
  res.json(ok(updated));
});

router.post("/v1/admin/drivers/:driverId/suspend", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.driverId) ? req.params.driverId[0] : req.params.driverId;

  const { reason } = req.body;
  if (!reason) {
    res.status(400).json({ success: false, error: "reason is required", data: null, meta: null });
    return;
  }

  const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.id, raw));
  if (!profile) {
    res.status(404).json({ success: false, error: "Driver not found", data: null, meta: null });
    return;
  }

  const [updated] = await db
    .update(driverProfilesTable)
    .set({ status: "suspended", suspendedAt: new Date(), suspendedBy: req.userId!, suspensionReason: reason })
    .where(eq(driverProfilesTable.id, raw))
    .returning();

  req.log.info({ driverProfileId: raw }, "Driver suspended");
  res.json(ok(updated));
});

router.get("/v1/admin/drivers/:driverId/documents", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.driverId) ? req.params.driverId[0] : req.params.driverId;
  const docs = await db
    .select()
    .from(driverDocumentsTable)
    .where(and(eq(driverDocumentsTable.driverProfileId, raw), isNull(driverDocumentsTable.deletedAt)));
  res.json(ok(docs));
});

router.post("/v1/admin/drivers/:driverId/documents/:documentId/verify", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const driverRaw = Array.isArray(req.params.driverId) ? req.params.driverId[0] : req.params.driverId;
  const docRaw = Array.isArray(req.params.documentId) ? req.params.documentId[0] : req.params.documentId;

  const { status, reviewNotes } = req.body;
  if (!status) {
    res.status(400).json({ success: false, error: "status is required", data: null, meta: null });
    return;
  }

  const [doc] = await db
    .select()
    .from(driverDocumentsTable)
    .where(and(eq(driverDocumentsTable.id, docRaw), eq(driverDocumentsTable.driverProfileId, driverRaw)));

  if (!doc) {
    res.status(404).json({ success: false, error: "Document not found", data: null, meta: null });
    return;
  }

  const [updated] = await db
    .update(driverDocumentsTable)
    .set({ status, reviewNotes: reviewNotes ?? null, reviewedBy: req.userId!, reviewedAt: new Date() })
    .where(eq(driverDocumentsTable.id, docRaw))
    .returning();

  req.log.info({ documentId: docRaw, status }, "Document verified");
  res.json(ok(updated));
});

export default router;
