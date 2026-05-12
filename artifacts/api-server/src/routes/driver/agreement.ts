import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, driverProfilesTable, agreementsTable, agreementSignaturesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireDriver as requireAuth } from "../../middlewares/auth";
import type { AuthenticatedRequest } from "../../middlewares/auth";
import { ok } from "../../lib/response";
import { newId } from "../../lib/ids";

const router: IRouter = Router();

const SignAgreementBody = z.object({
  legalName: z.string().min(1, "legalName is required"),
  signatureObjectPath: z.string().optional(),
});

router.get("/v1/agreements/active", requireAuth, async (_req, res): Promise<void> => {
  const [agreement] = await db
    .select()
    .from(agreementsTable)
    .where(eq(agreementsTable.status, "active"));
  if (!agreement) {
    res.status(404).json({ success: false, error: "No active agreement", data: null, meta: null });
    return;
  }
  res.json(ok(agreement));
});

router.get("/v1/drivers/me/agreement-signature", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, req.userId!));
  if (!profile) {
    res.status(404).json({ success: false, error: "Profile not found", data: null, meta: null });
    return;
  }

  const [sig] = await db
    .select()
    .from(agreementSignaturesTable)
    .where(and(eq(agreementSignaturesTable.driverProfileId, profile.id), eq(agreementSignaturesTable.status, "active")));

  res.json(ok(sig ?? null));
});

router.post("/v1/drivers/me/agreement-signature", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, req.userId!));
  if (!profile) {
    res.status(404).json({ success: false, error: "Profile not found", data: null, meta: null });
    return;
  }

  const [activeAgreement] = await db.select().from(agreementsTable).where(eq(agreementsTable.status, "active"));
  if (!activeAgreement) {
    res.status(404).json({ success: false, error: "No active agreement to sign", data: null, meta: null });
    return;
  }

  const parsed = SignAgreementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid request", data: null, meta: null });
    return;
  }

  const { legalName, signatureObjectPath } = parsed.data;

  await db
    .update(agreementSignaturesTable)
    .set({ status: "superseded" })
    .where(eq(agreementSignaturesTable.driverProfileId, profile.id));

  const now = new Date();
  const [sig] = await db
    .insert(agreementSignaturesTable)
    .values({
      id: newId(),
      agreementId: activeAgreement.id,
      driverProfileId: profile.id,
      userId: req.userId!,
      agreementVersion: activeAgreement.version,
      signedAt: now,
      legalName,
      signatureObjectPath: signatureObjectPath ?? null,
      status: "active",
    })
    .returning();

  await db
    .update(driverProfilesTable)
    .set({ agreementSignedAt: now })
    .where(eq(driverProfilesTable.id, profile.id));

  req.log.info({ sigId: sig.id, agreementId: activeAgreement.id }, "Agreement signed");
  res.status(201).json(ok(sig));
});

router.post("/v1/drivers/me/submit-application", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, req.userId!));
  if (!profile) {
    res.status(404).json({ success: false, error: "Profile not found", data: null, meta: null });
    return;
  }
  if (profile.status !== "incomplete" && profile.status !== "rejected") {
    res.status(400).json({ success: false, error: `Cannot submit from status: ${profile.status}`, data: null, meta: null });
    return;
  }

  const now = new Date();
  const [updated] = await db
    .update(driverProfilesTable)
    .set({ status: "pending", submittedAt: now })
    .where(eq(driverProfilesTable.id, profile.id))
    .returning();

  req.log.info({ profileId: profile.id }, "Driver application submitted");
  res.json(ok(updated));
});

export default router;
