import { Router, type IRouter } from "express";
import { db, driverProfilesTable, shiftsTable, vehiclesTable, shiftAllocationsTable, earningsTable } from "@workspace/db";
import { eq, and, lt } from "drizzle-orm";
import { requireAdmin } from "../../middlewares/auth";
import { ok } from "../../lib/response";

const router: IRouter = Router();

router.get("/v1/admin/dashboard/summary", requireAdmin, async (_req, res): Promise<void> => {
  const [
    allDrivers,
    pendingDrivers,
    approvedDrivers,
    openShifts,
    allVehicles,
    pendingAllocations,
    draftEarnings,
    shiftsNeedingAlloc,
  ] = await Promise.all([
    db.select().from(driverProfilesTable),
    db.select().from(driverProfilesTable).where(eq(driverProfilesTable.status, "pending")),
    db.select().from(driverProfilesTable).where(eq(driverProfilesTable.status, "approved")),
    db.select().from(shiftsTable).where(eq(shiftsTable.status, "open")),
    db.select().from(vehiclesTable),
    db.select().from(shiftAllocationsTable).where(eq(shiftAllocationsTable.status, "requested")),
    db.select().from(earningsTable).where(eq(earningsTable.status, "draft")),
    db.select().from(shiftsTable).where(
      and(
        eq(shiftsTable.status, "open"),
        lt(shiftsTable.confirmedCount, shiftsTable.capacity),
      )
    ),
  ]);

  res.json(ok({
    totalDrivers: allDrivers.length,
    approvedDrivers: approvedDrivers.length,
    pendingApplications: pendingDrivers.length,
    openShifts: openShifts.length,
    activeVehicles: allVehicles.length,
    pendingAllocations: pendingAllocations.length,
    earningsPendingPublish: draftEarnings.length,
    shiftsRequiringAllocation: shiftsNeedingAlloc.length,
  }));
});

export default router;
