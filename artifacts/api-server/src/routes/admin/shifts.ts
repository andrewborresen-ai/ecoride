import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, shiftsTable, shiftAllocationsTable, notificationsTable } from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";
import { requireAdmin } from "../../middlewares/auth";
import type { AuthenticatedRequest } from "../../middlewares/auth";
import { ok } from "../../lib/response";
import { newId } from "../../lib/ids";

const router: IRouter = Router();

const CreateShiftBody = z.object({
  title: z.string().min(1, "title is required"),
  description: z.string().optional(),
  fleetType: z.enum(["electric", "lpg"]).optional(),
  startTime: z.string().min(1, "startTime is required"),
  endTime: z.string().min(1, "endTime is required"),
  capacity: z.number().int().min(1).default(1),
});

const PatchShiftBody = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  capacity: z.number().int().min(1).optional(),
  status: z.enum(["open", "closed", "cancelled"]).optional(),
}).strict();

const DeclineAllocationBody = z.object({
  reason: z.string().min(1, "reason is required"),
});

router.get("/v1/admin/shifts", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const conditions: ReturnType<typeof eq>[] = [];
  if (req.query.status) conditions.push(eq(shiftsTable.status, req.query.status as string));
  if (req.query.from) conditions.push(gte(shiftsTable.startTime, new Date(req.query.from as string)));
  if (req.query.to) conditions.push(lte(shiftsTable.endTime, new Date(req.query.to as string)));

  const shifts = conditions.length > 0
    ? await db.select().from(shiftsTable).where(and(...conditions))
    : await db.select().from(shiftsTable);
  res.json(ok(shifts, { total: shifts.length }));
});

router.post("/v1/admin/shifts", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateShiftBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid request", data: null, meta: null });
    return;
  }

  const d = parsed.data;
  const [shift] = await db
    .insert(shiftsTable)
    .values({
      id: newId(),
      title: d.title,
      description: d.description ?? null,
      fleetType: d.fleetType ?? null,
      startTime: new Date(d.startTime),
      endTime: new Date(d.endTime),
      capacity: d.capacity,
      status: "open",
      createdBy: req.userId!,
    })
    .returning();

  req.log.info({ shiftId: shift.id }, "Shift created");
  res.status(201).json(ok(shift));
});

router.patch("/v1/admin/shifts/:shiftId", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.shiftId) ? req.params.shiftId[0] : req.params.shiftId;

  const parsed = PatchShiftBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid request", data: null, meta: null });
    return;
  }

  const [existing] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, raw));
  if (!existing) {
    res.status(404).json({ success: false, error: "Shift not found", data: null, meta: null });
    return;
  }

  const d = parsed.data;
  const updates: Record<string, unknown> = {};
  if (d.title !== undefined) updates.title = d.title;
  if (d.description !== undefined) updates.description = d.description;
  if (d.startTime !== undefined) updates.startTime = new Date(d.startTime);
  if (d.endTime !== undefined) updates.endTime = new Date(d.endTime);
  if (d.capacity !== undefined) updates.capacity = d.capacity;
  if (d.status !== undefined) updates.status = d.status;

  const [updated] = await db.update(shiftsTable).set(updates as never).where(eq(shiftsTable.id, raw)).returning();
  res.json(ok(updated));
});

router.get("/v1/admin/shifts/:shiftId/allocations", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.shiftId) ? req.params.shiftId[0] : req.params.shiftId;
  const allocations = await db.select().from(shiftAllocationsTable).where(eq(shiftAllocationsTable.shiftId, raw));
  res.json(ok(allocations, { total: allocations.length }));
});

router.post(
  "/v1/admin/shifts/:shiftId/allocations/:allocationId/confirm",
  requireAdmin,
  async (req: AuthenticatedRequest, res): Promise<void> => {
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

    if (allocation.status !== "requested" && allocation.status !== "waitlisted") {
      res.status(400).json({ success: false, error: `Cannot confirm allocation with status: ${allocation.status}`, data: null, meta: null });
      return;
    }

    const [updated] = await db
      .update(shiftAllocationsTable)
      .set({ status: "confirmed", confirmedAt: new Date(), confirmedBy: req.userId! })
      .where(eq(shiftAllocationsTable.id, allocRaw))
      .returning();

    const [shiftRow] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, shiftRaw));
    if (shiftRow) {
      const newCount = shiftRow.confirmedCount + 1;
      const shiftUpdates: Record<string, unknown> = { confirmedCount: newCount };
      if (newCount >= shiftRow.capacity && shiftRow.status === "open") {
        shiftUpdates.status = "full";
      }
      await db.update(shiftsTable).set(shiftUpdates as never).where(eq(shiftsTable.id, shiftRaw));
    }

    await db.insert(notificationsTable).values({
      id: newId(),
      userId: allocation.userId,
      title: allocation.status === "waitlisted" ? "Promoted from Waitlist" : "Shift Confirmed",
      body: allocation.status === "waitlisted"
        ? "Great news — you have been promoted from the waitlist and your shift is now confirmed."
        : "Your shift request has been confirmed.",
      type: "shift_confirmed",
      status: "unread",
      sentBy: req.userId!,
    });

    req.log.info({ allocationId: allocRaw }, "Shift allocation confirmed");
    res.json(ok(updated));
  }
);

router.post(
  "/v1/admin/shifts/:shiftId/allocations/:allocationId/waitlist",
  requireAdmin,
  async (req: AuthenticatedRequest, res): Promise<void> => {
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

    if (allocation.status !== "requested") {
      res.status(400).json({ success: false, error: `Cannot waitlist allocation with status: ${allocation.status}`, data: null, meta: null });
      return;
    }

    const [updated] = await db
      .update(shiftAllocationsTable)
      .set({ status: "waitlisted" })
      .where(eq(shiftAllocationsTable.id, allocRaw))
      .returning();

    await db.insert(notificationsTable).values({
      id: newId(),
      userId: allocation.userId,
      title: "Added to Waitlist",
      body: "You have been added to the shift waitlist. You will be notified if a spot opens up.",
      type: "shift_waitlisted",
      status: "unread",
      sentBy: req.userId!,
    });

    req.log.info({ allocationId: allocRaw }, "Shift allocation moved to waitlist");
    res.json(ok(updated));
  }
);

router.post(
  "/v1/admin/shifts/:shiftId/allocations/:allocationId/decline",
  requireAdmin,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const shiftRaw = Array.isArray(req.params.shiftId) ? req.params.shiftId[0] : req.params.shiftId;
    const allocRaw = Array.isArray(req.params.allocationId) ? req.params.allocationId[0] : req.params.allocationId;

    const parsed = DeclineAllocationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid request", data: null, meta: null });
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
      .set({ status: "declined", declinedAt: new Date(), declinedBy: req.userId!, declineReason: parsed.data.reason })
      .where(eq(shiftAllocationsTable.id, allocRaw))
      .returning();

    req.log.info({ allocationId: allocRaw }, "Shift allocation declined");
    res.json(ok(updated));
  }
);

export default router;
