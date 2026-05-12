import { Router, type IRouter } from "express";
import { db, driverProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireDriver as requireAuth } from "../../middlewares/auth";
import type { AuthenticatedRequest } from "../../middlewares/auth";
import { ok } from "../../lib/response";
import type { InsertDriverProfile } from "@workspace/db";

const router: IRouter = Router();

type DriverProfilePatch = Partial<Omit<InsertDriverProfile, "id" | "userId" | "status" | "telematicsDriverId" | "telematicsSyncStatus" | "telematicsRegisteredAt" | "telematicsLastSyncedAt" | "telematicsSyncError" | "approvedAt" | "approvedBy" | "rejectedAt" | "rejectedBy" | "rejectionReason" | "suspendedAt" | "suspendedBy" | "suspensionReason" | "submittedAt" | "profileCompletedAt" | "documentsCompletedAt" | "agreementSignedAt">>;

const ALLOWED_PATCH_FIELDS: (keyof DriverProfilePatch)[] = [
  "firstName", "lastName", "dateOfBirth", "idNumber", "phone",
  "streetAddress", "suburb", "city", "province", "postalCode",
  "bankName", "accountNumber", "accountType", "branchCode",
  "boltDriverId", "boltDeclarationAccepted", "fleetType",
];

router.get("/v1/drivers/me/profile", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, req.userId!));
  if (!profile) {
    res.status(404).json({ success: false, error: "Profile not found", data: null, meta: null });
    return;
  }
  res.json(ok(profile));
});

router.patch("/v1/drivers/me/profile", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, req.userId!));
  if (!profile) {
    res.status(404).json({ success: false, error: "Profile not found", data: null, meta: null });
    return;
  }

  const updates: DriverProfilePatch = {};
  for (const key of ALLOWED_PATCH_FIELDS) {
    if (key in req.body) {
      (updates as Record<string, unknown>)[key] = req.body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    res.json(ok(profile));
    return;
  }

  const [updated] = await db
    .update(driverProfilesTable)
    .set(updates)
    .where(eq(driverProfilesTable.userId, req.userId!))
    .returning();

  req.log.info({ profileId: profile.id }, "Driver profile updated");
  res.json(ok(updated));
});

export default router;
