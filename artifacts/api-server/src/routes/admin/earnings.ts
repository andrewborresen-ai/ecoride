import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, earningsTable, notificationsTable, driverProfilesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAdmin } from "../../middlewares/auth";
import type { AuthenticatedRequest } from "../../middlewares/auth";
import { ok } from "../../lib/response";
import { newId } from "../../lib/ids";

const router: IRouter = Router();

const CreateEarningsBody = z.object({
  driverProfileId: z.string().min(1),
  userId: z.string().optional(),
  periodStart: z.string().min(1, "periodStart is required"),
  periodEnd: z.string().min(1, "periodEnd is required"),
  currencyCode: z.string().length(3).default("ZAR"),
  grossAmountCents: z.number().int().min(0).default(0),
  deductionsCents: z.number().int().min(0).default(0),
  incentivesCents: z.number().int().min(0).default(0),
  penaltiesCents: z.number().int().min(0).default(0),
  netAmountCents: z.number().int().min(0).default(0),
  tripCount: z.number().int().min(0).default(0),
  shiftId: z.string().optional(),
  shiftAllocationId: z.string().optional(),
  notes: z.string().optional(),
});

const PatchEarningsBody = z.object({
  grossAmountCents: z.number().int().min(0).optional(),
  deductionsCents: z.number().int().min(0).optional(),
  incentivesCents: z.number().int().min(0).optional(),
  penaltiesCents: z.number().int().min(0).optional(),
  netAmountCents: z.number().int().min(0).optional(),
  tripCount: z.number().int().min(0).optional(),
  notes: z.string().optional(),
}).strict();

const CsvRowSchema = z.object({
  driverProfileId: z.string().min(1),
  userId: z.string().min(1),
  periodStart: z.string(),
  periodEnd: z.string(),
  currencyCode: z.string().length(3).default("ZAR"),
  grossAmountCents: z.coerce.number().int().min(0),
  deductionsCents: z.coerce.number().int().min(0).default(0),
  incentivesCents: z.coerce.number().int().min(0).default(0),
  penaltiesCents: z.coerce.number().int().min(0).default(0),
  netAmountCents: z.coerce.number().int().min(0),
  tripCount: z.coerce.number().int().min(0).default(0),
  notes: z.string().optional(),
});

router.get("/v1/admin/earnings", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const conditions: ReturnType<typeof eq>[] = [];
  if (req.query.status) conditions.push(eq(earningsTable.status, req.query.status as string));
  if (req.query.driverProfileId) conditions.push(eq(earningsTable.driverProfileId, req.query.driverProfileId as string));

  const earnings = conditions.length > 0
    ? await db.select().from(earningsTable).where(and(...conditions))
    : await db.select().from(earningsTable);

  res.json(ok(earnings, { total: earnings.length }));
});

router.post("/v1/admin/earnings", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateEarningsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid request", data: null, meta: null });
    return;
  }

  const d = parsed.data;

  const [prof] = await db.select({ userId: driverProfilesTable.userId }).from(driverProfilesTable).where(eq(driverProfilesTable.id, d.driverProfileId));
  if (!prof) {
    res.status(404).json({ success: false, error: "Driver profile not found", data: null, meta: null });
    return;
  }
  const resolvedUserId = prof.userId;

  const [record] = await db
    .insert(earningsTable)
    .values({
      id: newId(),
      driverProfileId: d.driverProfileId,
      userId: resolvedUserId,
      shiftId: d.shiftId ?? null,
      shiftAllocationId: d.shiftAllocationId ?? null,
      periodStart: new Date(d.periodStart),
      periodEnd: new Date(d.periodEnd),
      currencyCode: d.currencyCode,
      grossAmountCents: d.grossAmountCents,
      deductionsCents: d.deductionsCents,
      incentivesCents: d.incentivesCents,
      penaltiesCents: d.penaltiesCents,
      netAmountCents: d.netAmountCents,
      tripCount: d.tripCount,
      notes: d.notes ?? null,
      status: "draft",
      createdBy: req.userId!,
    })
    .returning();

  req.log.info({ earningsId: record.id }, "Earnings record created");
  res.status(201).json(ok(record));
});

router.patch("/v1/admin/earnings/:earningsId", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.earningsId) ? req.params.earningsId[0] : req.params.earningsId;

  const parsed = PatchEarningsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid request", data: null, meta: null });
    return;
  }

  const [existing] = await db.select().from(earningsTable).where(eq(earningsTable.id, raw));
  if (!existing) {
    res.status(404).json({ success: false, error: "Earnings not found", data: null, meta: null });
    return;
  }

  const updates = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));
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

  if (existing.status !== "draft") {
    res.status(400).json({ success: false, error: `Cannot publish earnings with status: ${existing.status}`, data: null, meta: null });
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
    body: "Your earnings for the period have been published.",
    type: "earnings_published",
    referenceType: "earnings",
    referenceId: raw,
    status: "unread",
    sentBy: req.userId!,
  });

  req.log.info({ earningsId: raw }, "Earnings published");
  res.json(ok(updated));
});

router.post("/v1/admin/earnings/:earningsId/unpublish", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.earningsId) ? req.params.earningsId[0] : req.params.earningsId;

  const [existing] = await db.select().from(earningsTable).where(eq(earningsTable.id, raw));
  if (!existing) {
    res.status(404).json({ success: false, error: "Earnings not found", data: null, meta: null });
    return;
  }

  if (existing.status !== "published") {
    res.status(400).json({ success: false, error: `Cannot recall earnings with status: ${existing.status}`, data: null, meta: null });
    return;
  }

  const [updated] = await db
    .update(earningsTable)
    .set({ status: "draft", publishedAt: null, publishedBy: null })
    .where(eq(earningsTable.id, raw))
    .returning();

  req.log.info({ earningsId: raw }, "Earnings recalled to draft");
  res.json(ok(updated));
});

router.post("/v1/admin/earnings/import-csv", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { rows } = req.body as { rows?: unknown[] };

  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ success: false, error: "rows array is required and must not be empty", data: null, meta: null });
    return;
  }

  const created: typeof earningsTable.$inferSelect[] = [];
  const errors: { index: number; error: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const parsed = CsvRowSchema.safeParse(rows[i]);
    if (!parsed.success) {
      errors.push({ index: i, error: parsed.error.issues[0]?.message ?? "Invalid row" });
      continue;
    }

    const d = parsed.data;

    // Verify driver profile exists
    const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.id, d.driverProfileId));
    if (!profile) {
      errors.push({ index: i, error: `driverProfileId not found: ${d.driverProfileId}` });
      continue;
    }

    const [record] = await db
      .insert(earningsTable)
      .values({
        id: newId(),
        driverProfileId: d.driverProfileId,
        userId: d.userId,
        shiftId: null,
        shiftAllocationId: null,
        periodStart: new Date(d.periodStart),
        periodEnd: new Date(d.periodEnd),
        currencyCode: d.currencyCode,
        grossAmountCents: d.grossAmountCents,
        deductionsCents: d.deductionsCents,
        incentivesCents: d.incentivesCents,
        penaltiesCents: d.penaltiesCents,
        netAmountCents: d.netAmountCents,
        tripCount: d.tripCount,
        notes: d.notes ?? null,
        status: "draft",
        createdBy: req.userId!,
      })
      .returning();

    created.push(record);
  }

  req.log.info({ imported: created.length, errors: errors.length }, "Earnings CSV import completed");
  res.status(errors.length === rows.length ? 400 : 201).json(
    ok({ imported: created.length, errors }, { total: created.length, errorCount: errors.length })
  );
});

const ShiftDetailSchema = z.object({
  date: z.string(),
  grossCents: z.number().int().default(0),
  rentalCents: z.number().int().default(0),
  netCents: z.number().int().default(0),
  trips: z.number().int().default(0),
  hours: z.number().default(0),
});

const PayrollRowSchema = z.object({
  driverName: z.string().min(1),
  resolvedProfileId: z.string().optional(),
  grossAmountCents: z.number().int().default(0),
  deductionsCents: z.number().int().min(0).default(0),
  incentivesCents: z.number().int().min(0).default(0),
  penaltiesCents: z.number().int().min(0).default(0),
  netAmountCents: z.number().int().min(0).default(0),
  tripCount: z.number().int().min(0).default(0),
  shiftDetails: z.array(ShiftDetailSchema).optional(),
});

const ImportPayrollBody = z.object({
  rows: z.array(PayrollRowSchema).min(1),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
});

router.post("/v1/admin/earnings/import-payroll-sheet", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = ImportPayrollBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid request", data: null, meta: null });
    return;
  }

  const { rows, periodStart, periodEnd } = parsed.data;

  // Load all driver profiles once for name-matching
  const allProfiles = await db
    .select({
      id: driverProfilesTable.id,
      userId: driverProfilesTable.userId,
      firstName: driverProfilesTable.firstName,
      lastName: driverProfilesTable.lastName,
    })
    .from(driverProfilesTable);

  const normStr = (s: string | null | undefined) =>
    (s ?? "").toUpperCase().replace(/\s+/g, " ").trim();

  const created: typeof earningsTable.$inferSelect[] = [];
  const unmatched: string[] = [];
  const errors: { driverName: string; error: string }[] = [];

  for (const row of rows) {
    let profile: (typeof allProfiles)[0] | undefined;

    if (row.resolvedProfileId) {
      profile = allProfiles.find((p) => p.id === row.resolvedProfileId);
      if (!profile) {
        errors.push({ driverName: row.driverName, error: `Profile ID ${row.resolvedProfileId} not found` });
        continue;
      }
    } else {
      const csvName = normStr(row.driverName);
      profile = allProfiles.find((p) => {
        const fn = normStr(p.firstName);
        const ln = normStr(p.lastName);
        return (
          `${fn} ${ln}`.trim() === csvName ||
          `${ln} ${fn}`.trim() === csvName ||
          fn === csvName ||
          ln === csvName
        );
      });
      if (!profile) {
        unmatched.push(row.driverName);
        continue;
      }
    }

    try {
      const [record] = await db
        .insert(earningsTable)
        .values({
          id: newId(),
          driverProfileId: profile.id,
          userId: profile.userId,
          shiftId: null,
          shiftAllocationId: null,
          periodStart: new Date(periodStart),
          periodEnd: new Date(periodEnd),
          currencyCode: "ZAR",
          grossAmountCents: Math.max(0, row.grossAmountCents),
          deductionsCents: row.deductionsCents,
          incentivesCents: row.incentivesCents,
          penaltiesCents: row.penaltiesCents,
          netAmountCents: row.netAmountCents,
          tripCount: row.tripCount,
          notes: null,
          shiftDetails: row.shiftDetails ?? null,
          status: "draft",
          createdBy: req.userId!,
        })
        .returning();
      created.push(record);
    } catch (err) {
      errors.push({ driverName: row.driverName, error: (err as Error).message });
    }
  }

  req.log.info({ imported: created.length, unmatched: unmatched.length, errors: errors.length }, "Payroll sheet import completed");
  res.status(created.length === 0 && rows.length > 0 ? 422 : 201).json(
    ok({ imported: created.length, unmatched, errors }, { total: rows.length })
  );
});

export default router;
