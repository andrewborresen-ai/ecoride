import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, agreementsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../../middlewares/auth";
import type { AuthenticatedRequest } from "../../middlewares/auth";
import { ok } from "../../lib/response";
import { newId } from "../../lib/ids";

const router: IRouter = Router();

const CreateAgreementBody = z.object({
  title: z.string().min(1, "title is required"),
  version: z.string().min(1, "version is required"),
  content: z.string().min(1, "content is required"),
  fleetType: z.enum(["electric", "lpg"]).optional(),
  pdfPath: z.string().optional(),
});

const PatchAgreementBody = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  pdfPath: z.string().optional(),
}).strict();

router.get("/v1/admin/agreements", requireAdmin, async (_req, res): Promise<void> => {
  const agreements = await db.select().from(agreementsTable);
  res.json(ok(agreements, { total: agreements.length }));
});

router.post("/v1/admin/agreements", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateAgreementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid request", data: null, meta: null });
    return;
  }

  const d = parsed.data;
  const [agreement] = await db
    .insert(agreementsTable)
    .values({
      id: newId(),
      title: d.title,
      version: d.version,
      content: d.content,
      pdfPath: d.pdfPath ?? null,
      fleetType: d.fleetType ?? null,
      status: "draft",
      createdBy: req.userId!,
    })
    .returning();

  req.log.info({ agreementId: agreement.id }, "Agreement created");
  res.status(201).json(ok(agreement));
});

router.patch("/v1/admin/agreements/:agreementId", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.agreementId) ? req.params.agreementId[0] : req.params.agreementId;

  const parsed = PatchAgreementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid request", data: null, meta: null });
    return;
  }

  const [existing] = await db.select().from(agreementsTable).where(eq(agreementsTable.id, raw));
  if (!existing) {
    res.status(404).json({ success: false, error: "Agreement not found", data: null, meta: null });
    return;
  }

  const updates = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));
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

  if (agreement.status !== "draft") {
    res.status(400).json({ success: false, error: `Cannot activate agreement with status: ${agreement.status}`, data: null, meta: null });
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
