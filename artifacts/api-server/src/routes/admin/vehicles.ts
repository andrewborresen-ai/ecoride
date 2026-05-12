import { Router, type IRouter } from "express";
import { db, vehiclesTable, vehicleAssignmentsTable, driverProfilesTable, vehicleAccessEventsTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { requireAdmin } from "../../middlewares/auth";
import type { AuthenticatedRequest } from "../../middlewares/auth";
import { ok } from "../../lib/response";
import { newId } from "../../lib/ids";
import * as telematics from "../../integrations/telematics";

const router: IRouter = Router();

router.get("/v1/admin/vehicles", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const conditions: ReturnType<typeof eq>[] = [isNull(vehiclesTable.deletedAt) as unknown as ReturnType<typeof eq>];
  if (req.query.status) conditions.push(eq(vehiclesTable.status, req.query.status as string));
  if (req.query.fleetType) conditions.push(eq(vehiclesTable.fleetType, req.query.fleetType as string));

  const vehicles = await db.select().from(vehiclesTable).where(and(...conditions));
  res.json(ok(vehicles));
});

router.post("/v1/admin/vehicles", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { registrationNumber, make, model, year, colour, vin, fleetType, telematicsVehicleId, telematicsEnabled, notes } = req.body;
  if (!registrationNumber) {
    res.status(400).json({ success: false, error: "registrationNumber required", data: null, meta: null });
    return;
  }

  const vehicleId = newId();
  const [vehicle] = await db
    .insert(vehiclesTable)
    .values({
      id: vehicleId,
      registrationNumber,
      make: make ?? null,
      model: model ?? null,
      year: year ?? null,
      colour: colour ?? null,
      vin: vin ?? null,
      fleetType: fleetType ?? "electric",
      telematicsVehicleId: telematicsVehicleId ?? null,
      telematicsEnabled: telematicsEnabled ?? "false",
      notes: notes ?? null,
      status: "available",
      createdBy: req.userId!,
    })
    .returning();

  req.log.info({ vehicleId }, "Vehicle registered");
  res.status(201).json(ok(vehicle));
});

router.patch("/v1/admin/vehicles/:vehicleId", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.vehicleId) ? req.params.vehicleId[0] : req.params.vehicleId;

  const [existing] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, raw));
  if (!existing || existing.deletedAt) {
    res.status(404).json({ success: false, error: "Vehicle not found", data: null, meta: null });
    return;
  }

  const allowed = ["registrationNumber","make","model","year","colour","vin","fleetType","telematicsVehicleId","telematicsEnabled","status","notes"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }

  const [updated] = await db.update(vehiclesTable).set(updates as never).where(eq(vehiclesTable.id, raw)).returning();
  res.json(ok(updated));
});

router.get("/v1/admin/vehicle-assignments", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  let query = db.select().from(vehicleAssignmentsTable).$dynamic();

  const conditions: ReturnType<typeof eq>[] = [];
  if (req.query.status) conditions.push(eq(vehicleAssignmentsTable.status, req.query.status as string));
  if (req.query.shiftId) conditions.push(eq(vehicleAssignmentsTable.shiftId, req.query.shiftId as string));
  if (req.query.driverProfileId) conditions.push(eq(vehicleAssignmentsTable.driverProfileId, req.query.driverProfileId as string));

  if (conditions.length > 0) query = query.where(and(...conditions));

  const assignments = await query;
  res.json(ok(assignments));
});

router.post("/v1/admin/vehicle-assignments", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { vehicleId, driverProfileId, shiftId, shiftAllocationId, assignmentStart, assignmentEnd } = req.body;

  if (!vehicleId || !driverProfileId || !assignmentStart || !assignmentEnd) {
    res.status(400).json({ success: false, error: "vehicleId, driverProfileId, assignmentStart, assignmentEnd required", data: null, meta: null });
    return;
  }

  const [vehicle] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, vehicleId));
  if (!vehicle) {
    res.status(404).json({ success: false, error: "Vehicle not found", data: null, meta: null });
    return;
  }

  const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.id, driverProfileId));
  if (!profile) {
    res.status(404).json({ success: false, error: "Driver not found", data: null, meta: null });
    return;
  }

  const assignmentId = newId();
  const [assignment] = await db
    .insert(vehicleAssignmentsTable)
    .values({
      id: assignmentId,
      vehicleId,
      driverProfileId,
      userId: profile.userId,
      shiftId: shiftId ?? null,
      shiftAllocationId: shiftAllocationId ?? null,
      assignmentStart: new Date(assignmentStart),
      assignmentEnd: new Date(assignmentEnd),
      status: "active",
      assignedBy: req.userId!,
      telematicsSyncStatus: "not_synced",
    })
    .returning();

  // Trigger telematics assignment creation if both driver and vehicle have telematics IDs
  if (profile.telematicsDriverId && vehicle.telematicsVehicleId) {
    telematics.createAssignment({
      vehicleAssignmentId: assignmentId,
      telematicsDriverId: profile.telematicsDriverId,
      telematicsVehicleId: vehicle.telematicsVehicleId,
      assignmentStart: new Date(assignmentStart),
      assignmentEnd: new Date(assignmentEnd),
    }).then(async (result) => {
      if (result.success && result.telematicsAssignmentId) {
        await db
          .update(vehicleAssignmentsTable)
          .set({
            telematicsAssignmentId: result.telematicsAssignmentId,
            telematicsSyncStatus: "synced",
            telematicsSyncedAt: new Date(),
          })
          .where(eq(vehicleAssignmentsTable.id, assignmentId));
      } else {
        await db
          .update(vehicleAssignmentsTable)
          .set({ telematicsSyncStatus: "failed", telematicsSyncError: result.error ?? "unknown" })
          .where(eq(vehicleAssignmentsTable.id, assignmentId));
      }
    });
  }

  req.log.info({ assignmentId }, "Vehicle assignment created");
  res.status(201).json(ok(assignment));
});

router.get("/v1/admin/vehicle-access-events", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  let query = db.select().from(vehicleAccessEventsTable).$dynamic();

  const conditions: ReturnType<typeof eq>[] = [];
  if (req.query.vehicleId) conditions.push(eq(vehicleAccessEventsTable.vehicleId, req.query.vehicleId as string));
  if (req.query.driverProfileId) conditions.push(eq(vehicleAccessEventsTable.driverProfileId, req.query.driverProfileId as string));

  if (conditions.length > 0) query = query.where(and(...conditions));

  const events = await query;
  res.json(ok(events));
});

export default router;
