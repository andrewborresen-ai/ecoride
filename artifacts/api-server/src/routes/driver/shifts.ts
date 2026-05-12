import { Router, type IRouter } from "express";
import { db, shiftsTable, shiftAllocationsTable, driverProfilesTable } from "@workspace/db";
import { eq, and, gte, lte, or } from "drizzle-orm";
import { requireDriver as requireAuth } from "../../middlewares/auth";
import type { AuthenticatedRequest } from "../../middlewares/auth";
import { ok } from "../../lib/response";
import { newId } from "../../lib/ids";

const router: IRouter = Router();

router.get("/v1/shifts", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const conditions = [eq(shiftsTable.status, "open")];
  if (req.query.fleetType) conditions.push(eq(shiftsTable.fleetType, req.query.fleetType as string));
  if (req.query.from) conditions.push(gte(shiftsTable.startTime, new Date(req.query.from as string)));
  if (req.query.to) conditions.push(lte(shiftsTable.endTime, new Date(req.query.to as string)));

  const shifts = await db.select().from(shiftsTable).where(and(...conditions));
  res.json(ok(shifts));
});

router.post("/v1/shifts/:shiftId/request", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.shiftId) ? req.params.shiftId[0] : req.params.shiftId;

  const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, req.userId!));
  if (!profile || profile.status !== "approved") {
    res.status(403).json({ success: false, error: "Only approved drivers can request shifts", data: null, meta: null });
    return;
  }

  const [shift] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, raw));
  if (!shift || shift.status !== "open") {
    res.status(404).json({ success: false, error: "Shift not available", data: null, meta: null });
    return;
  }

  const existing = await db
    .select()
    .from(shiftAllocationsTable)
    .where(and(eq(shiftAllocationsTable.shiftId, raw), eq(shiftAllocationsTable.driverProfileId, profile.id)));

  if (existing.length > 0) {
    res.status(409).json({ success: false, error: "Already requested this shift", data: null, meta: null });
    return;
  }

  const [allocation] = await db
    .insert(shiftAllocationsTable)
    .values({
      id: newId(),
      shiftId: raw,
      driverProfileId: profile.id,
      userId: req.userId!,
      status: "requested",
      requestedAt: new Date(),
    })
    .returning();

  req.log.info({ allocationId: allocation.id, shiftId: raw }, "Shift requested");
  res.status(201).json(ok(allocation));
});

router.get("/v1/drivers/me/allocations", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, req.userId!));
  if (!profile) {
    res.status(404).json({ success: false, error: "Profile not found", data: null, meta: null });
    return;
  }

  const conditions = [eq(shiftAllocationsTable.driverProfileId, profile.id)];
  if (req.query.status) conditions.push(eq(shiftAllocationsTable.status, req.query.status as string));

  const allocations = await db.select().from(shiftAllocationsTable).where(and(...conditions));
  res.json(ok(allocations));
});

router.delete("/v1/drivers/me/allocations/:allocationId", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.allocationId) ? req.params.allocationId[0] : req.params.allocationId;

  const [allocation] = await db
    .select()
    .from(shiftAllocationsTable)
    .where(and(eq(shiftAllocationsTable.id, raw), eq(shiftAllocationsTable.userId, req.userId!)));

  if (!allocation) {
    res.status(404).json({ success: false, error: "Allocation not found", data: null, meta: null });
    return;
  }

  if (!["requested"].includes(allocation.status)) {
    res.status(400).json({ success: false, error: "Only pending requests can be cancelled", data: null, meta: null });
    return;
  }

  const [updated] = await db
    .update(shiftAllocationsTable)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(eq(shiftAllocationsTable.id, raw))
    .returning();

  req.log.info({ allocationId: raw }, "Shift allocation cancelled");
  res.json(ok(updated));
});

export default router;
