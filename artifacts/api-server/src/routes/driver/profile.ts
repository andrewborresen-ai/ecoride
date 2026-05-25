import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, driverProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireDriver } from "../../middlewares/auth";
import type { AuthenticatedRequest } from "../../middlewares/auth";
import { ok } from "../../lib/response";

const router: IRouter = Router();

const PatchProfileBody = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  dateOfBirth: z.string().optional(),
  idNumber: z.string().optional(),
  phone: z.string().optional(),
  streetAddress: z.string().optional(),
  suburb: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  accountType: z.string().optional(),
  branchCode: z.string().optional(),
  boltDriverId: z.string().optional(),
  boltDeclarationAccepted: z.string().optional(),
  fleetType: z.enum(["electric", "lpg"]).optional(),
}).strict();

router.get("/v1/drivers/me/profile", requireDriver, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, req.userId!));
  if (!profile) {
    res.status(404).json({ success: false, error: "Profile not found", data: null, meta: null });
    return;
  }
  res.json(ok(profile));
});

router.patch("/v1/drivers/me/profile", requireDriver, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, req.userId!));
  if (!profile) {
    res.status(404).json({ success: false, error: "Profile not found", data: null, meta: null });
    return;
  }

  const parsed = PatchProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid request", data: null, meta: null });
    return;
  }

  const updates = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));

  if (Object.keys(updates).length === 0) {
    res.json(ok(profile));
    return;
  }

  const [updated] = await db
    .update(driverProfilesTable)
    .set(updates as never)
    .where(eq(driverProfilesTable.userId, req.userId!))
    .returning();

  req.log.info({ profileId: profile.id }, "Driver profile updated");
  res.json(ok(updated));
});

export default router;
