import { Router, type IRouter } from "express";
import { db, driverProfilesTable, vehicleAssignmentsTable, vehiclesTable, vehicleAccessEventsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../../middlewares/auth";
import type { AuthenticatedRequest } from "../../middlewares/auth";
import { ok } from "../../lib/response";
import { newId } from "../../lib/ids";
import * as telematics from "../../integrations/telematics";

const router: IRouter = Router();

router.get("/v1/drivers/me/vehicle-assignment", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, req.userId!));
  if (!profile) {
    res.status(404).json({ success: false, error: "Profile not found", data: null, meta: null });
    return;
  }

  const [assignment] = await db
    .select()
    .from(vehicleAssignmentsTable)
    .where(and(eq(vehicleAssignmentsTable.driverProfileId, profile.id), eq(vehicleAssignmentsTable.status, "active")));

  if (!assignment) {
    res.json(ok(null));
    return;
  }

  const [vehicle] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, assignment.vehicleId));
  res.json(ok({ assignment, vehicle: vehicle ?? null }));
});

router.post("/v1/drivers/me/vehicle-assignments/:assignmentId/unlock", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.assignmentId) ? req.params.assignmentId[0] : req.params.assignmentId;

  const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, req.userId!));
  if (!profile) {
    res.status(404).json({ success: false, error: "Profile not found", data: null, meta: null });
    return;
  }

  if (profile.status !== "approved") {
    res.status(403).json({ success: false, error: "Account not approved", data: null, meta: null });
    return;
  }

  const [assignment] = await db
    .select()
    .from(vehicleAssignmentsTable)
    .where(and(eq(vehicleAssignmentsTable.id, raw), eq(vehicleAssignmentsTable.driverProfileId, profile.id)));

  if (!assignment || assignment.status !== "active") {
    res.status(404).json({ success: false, error: "No active assignment found", data: null, meta: null });
    return;
  }

  const now = new Date();
  if (now < assignment.assignmentStart || now > assignment.assignmentEnd) {
    res.status(400).json({ success: false, error: "Outside your shift window", data: null, meta: null });
    return;
  }

  const [vehicle] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, assignment.vehicleId));
  if (!vehicle || vehicle.telematicsEnabled !== "true") {
    res.status(400).json({ success: false, error: "Vehicle not connected to telematics", data: null, meta: null });
    return;
  }

  if (!profile.telematicsDriverId) {
    res.status(400).json({ success: false, error: "Driver not registered with telematics — contact support", data: null, meta: null });
    return;
  }

  if (!assignment.telematicsAssignmentId) {
    res.status(400).json({ success: false, error: "Assignment not synced with telematics — contact support", data: null, meta: null });
    return;
  }

  const accessEventId = newId();
  await db.insert(vehicleAccessEventsTable).values({
    id: accessEventId,
    vehicleAssignmentId: assignment.id,
    vehicleId: vehicle.id,
    driverProfileId: profile.id,
    userId: req.userId!,
    eventType: "unlock_request",
    eventStatus: "pending",
    requestedAt: now,
    status: "pending",
  });

  const result = await telematics.requestUnlock({
    vehicleAccessEventId: accessEventId,
    telematicsAssignmentId: assignment.telematicsAssignmentId,
    telematicsDriverId: profile.telematicsDriverId,
    telematicsVehicleId: vehicle.telematicsVehicleId!,
  });

  const eventStatus = result.success ? "success" : "failed";
  await db
    .update(vehicleAccessEventsTable)
    .set({
      eventStatus,
      telematicsRequestId: result.telematicsRequestId ?? null,
      failureReason: result.failureReason ?? null,
      resolvedAt: new Date(),
      status: eventStatus,
    })
    .where(eq(vehicleAccessEventsTable.id, accessEventId));

  await db
    .update(vehicleAssignmentsTable)
    .set({
      lastUnlockStatus: eventStatus,
      lastUnlockAttemptAt: now,
    })
    .where(eq(vehicleAssignmentsTable.id, assignment.id));

  if (!result.success) {
    req.log.warn({ assignmentId: raw, reason: result.failureReason }, "Vehicle unlock failed");
    res.status(422).json({
      success: false,
      error: result.failureReason ?? "Telematics validation failed",
      data: { accessEventId },
      meta: null,
    });
    return;
  }

  req.log.info({ accessEventId, assignmentId: raw }, "Vehicle unlock requested");
  res.json(ok({ accessEventId, telematicsRequestId: result.telematicsRequestId }));
});

router.get("/v1/drivers/me/vehicle-assignments/:assignmentId/access-status", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.assignmentId) ? req.params.assignmentId[0] : req.params.assignmentId;

  const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, req.userId!));
  if (!profile) {
    res.status(404).json({ success: false, error: "Profile not found", data: null, meta: null });
    return;
  }

  const [assignment] = await db
    .select()
    .from(vehicleAssignmentsTable)
    .where(and(eq(vehicleAssignmentsTable.id, raw), eq(vehicleAssignmentsTable.driverProfileId, profile.id)));

  if (!assignment) {
    res.status(404).json({ success: false, error: "Assignment not found", data: null, meta: null });
    return;
  }

  res.json(ok({
    assignmentId: assignment.id,
    status: assignment.status,
    lastUnlockStatus: assignment.lastUnlockStatus,
    lastUnlockAttemptAt: assignment.lastUnlockAttemptAt,
  }));
});

export default router;
