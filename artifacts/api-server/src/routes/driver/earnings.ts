import { Router, type IRouter } from "express";
import { db, earningsTable, driverProfilesTable } from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";
import { requireAuth } from "../../middlewares/auth";
import type { AuthenticatedRequest } from "../../middlewares/auth";
import { ok } from "../../lib/response";

const router: IRouter = Router();

router.get("/v1/drivers/me/earnings", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, req.userId!));
  if (!profile) {
    res.status(404).json({ success: false, error: "Profile not found", data: null, meta: null });
    return;
  }

  const conditions = [
    eq(earningsTable.driverProfileId, profile.id),
    eq(earningsTable.status, "published"),
  ];
  if (req.query.from) conditions.push(gte(earningsTable.periodStart, new Date(req.query.from as string)));
  if (req.query.to) conditions.push(lte(earningsTable.periodEnd, new Date(req.query.to as string)));

  const earnings = await db.select().from(earningsTable).where(and(...conditions));
  res.json(ok(earnings));
});

router.get("/v1/drivers/me/earnings/:earningsId", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.earningsId) ? req.params.earningsId[0] : req.params.earningsId;

  const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, req.userId!));
  if (!profile) {
    res.status(404).json({ success: false, error: "Profile not found", data: null, meta: null });
    return;
  }

  const [earnings] = await db
    .select()
    .from(earningsTable)
    .where(and(eq(earningsTable.id, raw), eq(earningsTable.driverProfileId, profile.id), eq(earningsTable.status, "published")));

  if (!earnings) {
    res.status(404).json({ success: false, error: "Earnings not found", data: null, meta: null });
    return;
  }

  res.json(ok(earnings));
});

export default router;
