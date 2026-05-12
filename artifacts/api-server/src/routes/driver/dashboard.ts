import { Router, type IRouter } from "express";
import { db, driverProfilesTable, shiftAllocationsTable, shiftsTable, earningsTable, notificationsTable, vehicleAssignmentsTable, vehiclesTable } from "@workspace/db";
import { eq, and, gte, lte, count } from "drizzle-orm";
import { requireAuth } from "../../middlewares/auth";
import type { AuthenticatedRequest } from "../../middlewares/auth";
import { ok } from "../../lib/response";

const router: IRouter = Router();

router.get("/v1/drivers/me/dashboard/summary", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, req.userId!));
  if (!profile) {
    res.status(404).json({ success: false, error: "Profile not found", data: null, meta: null });
    return;
  }

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const [activeAssignment] = await db
    .select()
    .from(vehicleAssignmentsTable)
    .where(and(eq(vehicleAssignmentsTable.driverProfileId, profile.id), eq(vehicleAssignmentsTable.status, "active")));

  let activeVehicle = null;
  if (activeAssignment) {
    const [v] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, activeAssignment.vehicleId));
    activeVehicle = v ?? null;
  }

  const confirmedAllocations = await db
    .select({ alloc: shiftAllocationsTable, shift: shiftsTable })
    .from(shiftAllocationsTable)
    .innerJoin(shiftsTable, eq(shiftAllocationsTable.shiftId, shiftsTable.id))
    .where(and(
      eq(shiftAllocationsTable.driverProfileId, profile.id),
      eq(shiftAllocationsTable.status, "confirmed"),
      gte(shiftsTable.startTime, now),
    ));

  const nextShift = confirmedAllocations[0] ?? null;

  const weeklyAllocations = await db
    .select()
    .from(shiftAllocationsTable)
    .where(and(
      eq(shiftAllocationsTable.driverProfileId, profile.id),
      eq(shiftAllocationsTable.status, "confirmed"),
    ));

  const weeklyEarnings = await db
    .select()
    .from(earningsTable)
    .where(and(
      eq(earningsTable.driverProfileId, profile.id),
      eq(earningsTable.status, "published"),
      gte(earningsTable.periodStart, weekStart),
      lte(earningsTable.periodEnd, weekEnd),
    ));

  const weeklyNetCents = weeklyEarnings.reduce((sum, e) => sum + e.netAmountCents, 0);

  const unreadNotifications = await db
    .select()
    .from(notificationsTable)
    .where(and(eq(notificationsTable.userId, req.userId!), eq(notificationsTable.status, "unread")));

  const latestNotifications = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, req.userId!));

  res.json(ok({
    profile: {
      id: profile.id,
      status: profile.status,
      firstName: profile.firstName,
      lastName: profile.lastName,
    },
    activeVehicleAssignment: activeAssignment ? { assignment: activeAssignment, vehicle: activeVehicle } : null,
    nextShift: nextShift ? { allocation: nextShift.alloc, shift: nextShift.shift } : null,
    shiftsThisWeek: weeklyAllocations.length,
    weeklyEarningsCents: weeklyNetCents,
    currencyCode: "ZAR",
    unreadNotificationsCount: unreadNotifications.length,
    latestNotifications: latestNotifications.slice(0, 5),
  }));
});

export default router;
