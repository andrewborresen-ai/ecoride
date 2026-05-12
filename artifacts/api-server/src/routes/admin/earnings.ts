import { Router, type IRouter } from "express";
import { db, earningsTable, notificationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAdmin } from "../../middlewares/auth";
import type { AuthenticatedRequest } from "../../middlewares/auth";
import { ok } from "../../lib/response";
import { newId } from "../../lib/ids";

const router: IRouter = Router();

router.get("/v1/admin/earnings", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const conditions: ReturnType<typeof eq>[] = [];
  if (req.query.status) conditions.push(eq(earningsTable.status, req.query.status as string));
  if (req.query.driverProfileId) conditions.push(eq(earningsTable.driverProfileId, req.query.driverProfileId as string));

  const earnings = conditions.length > 0
    ? await db.select().from(earningsTable).where(and(...conditions))
    : await db.select().from(earningsTable);

  res.json(ok(earnings));
});

router.post("/v1/admin/earnings", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { driverProfileId, userId, periodStart, periodEnd, currencyCode, grossAmountCents, deductionsCents, incentivesCents, penaltiesCents, netAmountCents, tripCount, shiftId, shiftAllocationId, notes } = req.body;

  if (!driverProfileId || !userId || !periodStart || !periodEnd) {
    res.status(400).json({ success: false, error: "driverProfileId, userId, periodStart, periodEnd required", data: null, meta: null });
    return;
  }

  const [record] = await db
    .insert(earningsTable)
    .values({
      id: newId(),
      driverProfileId,
      userId,
      shiftId: shiftId ?? null,
      shiftAllocationId: shiftAllocationId ?? null,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      currencyCode: currencyCode ?? "ZAR",
      grossAmountCents: grossAmountCents ?? 0,
      deductionsCents: deductionsCents ?? 0,
      incentivesCents: incentivesCents ?? 0,
      penaltiesCents: penaltiesCents ?? 0,
      netAmountCents: netAmountCents ?? 0,
      tripCount: tripCount ?? 0,
      notes: notes ?? null,
      status: "draft",
      createdBy: req.userId!,
    })
    .returning();

  req.log.info({ earningsId: record.id }, "Earnings record created");
  res.status(201).json(ok(record));
});

router.patch("/v1/admin/earnings/:earningsId", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.earningsId) ? req.params.earningsId[0] : req.params.earningsId;

  const [existing] = await db.select().from(earningsTable).where(eq(earningsTable.id, raw));
  if (!existing) {
    res.status(404).json({ success: false, error: "Earnings not found", data: null, meta: null });
    return;
  }

  const allowed = ["grossAmountCents","deductionsCents","incentivesCents","penaltiesCents","netAmountCents","tripCount","notes"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }

  const [updated] = await db.update(earningsTable).set(updates as never).where(eq(earningsTable.id, raw)).returning();
  res.json(ok(updated));
});

router.post("/v1/admin/earnings/:earningsId/publish", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.earningsId) ? req.params.earningsId[0] : req.params.earningsId;

  const [existing] = await db.select().from(earningsTable).where(eq(earningsTable.id, raw));
  if (!existing) {
    res.status(404).json({ success: false, error: "Earnings not found", data: null, meta: null });
    return;
  }

  const now = new Date();
  const [updated] = await db
    .update(earningsTable)
    .set({ status: "published", publishedAt: now, publishedBy: req.userId! })
    .where(eq(earningsTable.id, raw))
    .returning();

  await db.insert(notificationsTable).values({
    id: newId(),
    userId: existing.userId,
    title: "Earnings Published",
    body: `Your earnings for the period have been published.`,
    type: "earnings_published",
    referenceType: "earnings",
    referenceId: raw,
    status: "unread",
    sentBy: req.userId!,
  });

  req.log.info({ earningsId: raw }, "Earnings published");
  res.json(ok(updated));
});

export default router;
