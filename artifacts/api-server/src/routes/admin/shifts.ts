import { Router, type IRouter } from "express";
import { db, shiftsTable, shiftAllocationsTable, driverProfilesTable, notificationsTable } from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";
import { requireAdmin } from "../../middlewares/auth";
import type { AuthenticatedRequest } from "../../middlewares/auth";
import { ok } from "../../lib/response";
import { newId } from "../../lib/ids";

const router: IRouter = Router();

router.get("/v1/admin/shifts", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const conditions: ReturnType<typeof eq>[] = [];
  if (req.query.status) conditions.push(eq(shiftsTable.status, req.query.status as string));
  if (req.query.from) conditions.push(gte(shiftsTable.startTime, new Date(req.query.from as string)));
  if (req.query.to) conditions.push(lte(shiftsTable.endTime, new Date(req.query.to as string)));

  const shifts = conditions.length > 0
    ? await db.select().from(shiftsTable).where(and(...conditions))
    : await db.select().from(shiftsTable);
  res.json(ok(shifts));
});

router.post("/v1/admin/shifts", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { title, description, fleetType, startTime, endTime, capacity } = req.body;
  if (!title || !startTime || !endTime) {
    res.status(400).json({ success: false, error: "title, startTime, endTime required", data: null, meta: null });
    return;
  }

  const [shift] = await db
    .insert(shiftsTable)
    .values({
      id: newId(),
      title,
      description: description ?? null,
      fleetType: fleetType ?? null,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      capacity: capacity ?? 1,
      status: "open",
      createdBy: req.userId!,
    })
    .returning();

  req.log.info({ shiftId: shift.id }, "Shift created");
  res.status(201).json(ok(shift));
});

router.patch("/v1/admin/shifts/:shiftId", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.shiftId) ? req.params.shiftId[0] : req.params.shiftId;

  const [existing] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, raw));
  if (!existing) {
    res.status(404).json({ success: false, error: "Shift not found", data: null, meta: null });
    return;
  }

  const allowed = ["title","description","startTime","endTime","capacity","status"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in req.body) {
      updates[key] = ["startTime","endTime"].includes(key) ? new Date(req.body[key]) : req.body[key];
    }
  }

  const [updated] = await db.update(shiftsTable).set(updates as never).where(eq(shiftsTable.id, raw)).returning();
  res.json(ok(updated));
});

router.get("/v1/admin/shifts/:shiftId/allocations", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.shiftId) ? req.params.shiftId[0] : req.params.shiftId;
  const allocations = await db.select().from(shiftAllocationsTable).where(eq(shiftAllocationsTable.shiftId, raw));
  res.json(ok(allocations));
});

router.post("/v1/admin/shifts/:shiftId/allocations/:allocationId/confirm", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const shiftRaw = Array.isArray(req.params.shiftId) ? req.params.shiftId[0] : req.params.shiftId;
  const allocRaw = Array.isArray(req.params.allocationId) ? req.params.allocationId[0] : req.params.allocationId;

  const [allocation] = await db
    .select()
    .from(shiftAllocationsTable)
    .where(and(eq(shiftAllocationsTable.id, allocRaw), eq(shiftAllocationsTable.shiftId, shiftRaw)));

  if (!allocation) {
    res.status(404).json({ success: false, error: "Allocation not found", data: null, meta: null });
    return;
  }

  const [updated] = await db
    .update(shiftAllocationsTable)
    .set({ status: "confirmed", confirmedAt: new Date(), confirmedBy: req.userId! })
    .where(eq(shiftAllocationsTable.id, allocRaw))
    .returning();

  await db
    .update(shiftsTable)
    .set({ confirmedCount: (await db.select().from(shiftsTable).where(eq(shiftsTable.id, shiftRaw)))[0]!.confirmedCount + 1 })
    .where(eq(shiftsTable.id, shiftRaw));

  await db.insert(notificationsTable).values({
    id: newId(),
    userId: allocation.userId,
    title: "Shift Confirmed",
    body: "Your shift request has been confirmed.",
    type: "shift_confirmed",
    status: "unread",
    sentBy: req.userId!,
  });

  req.log.info({ allocationId: allocRaw }, "Shift allocation confirmed");
  res.json(ok(updated));
});

router.post("/v1/admin/shifts/:shiftId/allocations/:allocationId/decline", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const shiftRaw = Array.isArray(req.params.shiftId) ? req.params.shiftId[0] : req.params.shiftId;
  const allocRaw = Array.isArray(req.params.allocationId) ? req.params.allocationId[0] : req.params.allocationId;

  const { reason } = req.body;
  if (!reason) {
    res.status(400).json({ success: false, error: "reason is required", data: null, meta: null });
    return;
  }

  const [allocation] = await db
    .select()
    .from(shiftAllocationsTable)
    .where(and(eq(shiftAllocationsTable.id, allocRaw), eq(shiftAllocationsTable.shiftId, shiftRaw)));

  if (!allocation) {
    res.status(404).json({ success: false, error: "Allocation not found", data: null, meta: null });
    return;
  }

  const [updated] = await db
    .update(shiftAllocationsTable)
    .set({ status: "declined", declinedAt: new Date(), declinedBy: req.userId!, declineReason: reason })
    .where(eq(shiftAllocationsTable.id, allocRaw))
    .returning();

  req.log.info({ allocationId: allocRaw }, "Shift allocation declined");
  res.json(ok(updated));
});

export default router;
