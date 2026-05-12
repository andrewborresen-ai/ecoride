import { Router, type IRouter } from "express";
import { db, agreementsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../../middlewares/auth";
import type { AuthenticatedRequest } from "../../middlewares/auth";
import { ok } from "../../lib/response";
import { newId } from "../../lib/ids";

const router: IRouter = Router();

router.get("/v1/admin/agreements", requireAdmin, async (_req, res): Promise<void> => {
  const agreements = await db.select().from(agreementsTable);
  res.json(ok(agreements));
});

router.post("/v1/admin/agreements", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { title, version, content, fleetType } = req.body;
  if (!title || !version || !content) {
    res.status(400).json({ success: false, error: "title, version, content required", data: null, meta: null });
    return;
  }

  const [agreement] = await db
    .insert(agreementsTable)
    .values({ id: newId(), title, version, content, fleetType: fleetType ?? null, status: "draft", createdBy: req.userId! })
    .returning();

  req.log.info({ agreementId: agreement.id }, "Agreement created");
  res.status(201).json(ok(agreement));
});

router.patch("/v1/admin/agreements/:agreementId", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.agreementId) ? req.params.agreementId[0] : req.params.agreementId;

  const [existing] = await db.select().from(agreementsTable).where(eq(agreementsTable.id, raw));
  if (!existing) {
    res.status(404).json({ success: false, error: "Agreement not found", data: null, meta: null });
    return;
  }

  const updates: Record<string, unknown> = {};
  if ("title" in req.body) updates.title = req.body.title;
  if ("content" in req.body) updates.content = req.body.content;

  const [updated] = await db.update(agreementsTable).set(updates as never).where(eq(agreementsTable.id, raw)).returning();
  res.json(ok(updated));
});

router.post("/v1/admin/agreements/:agreementId/activate", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.agreementId) ? req.params.agreementId[0] : req.params.agreementId;

  const [agreement] = await db.select().from(agreementsTable).where(eq(agreementsTable.id, raw));
  if (!agreement) {
    res.status(404).json({ success: false, error: "Agreement not found", data: null, meta: null });
    return;
  }

  await db.update(agreementsTable).set({ status: "archived" }).where(eq(agreementsTable.status, "active"));

  const [updated] = await db
    .update(agreementsTable)
    .set({ status: "active", activatedAt: new Date(), activatedBy: req.userId! })
    .where(eq(agreementsTable.id, raw))
    .returning();

  req.log.info({ agreementId: raw }, "Agreement activated");
  res.json(ok(updated));
});

export default router;
