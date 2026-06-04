import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, vehiclesTable, vehicleAssignmentsTable, driverProfilesTable, vehicleAccessEventsTable } from "@workspace/db";
import { eq, and, isNull, gte, lte } from "drizzle-orm";
import { requireAdmin } from "../../middlewares/auth";
import type { AuthenticatedRequest } from "../../middlewares/auth";
import { ok } from "../../lib/response";
import { newId } from "../../lib/ids";
import * as telematics from "../../integrations/telematics";

const router: IRouter = Router();

const CreateVehicleBody = z.object({
  registrationNumber: z.string().min(1, "registrationNumber is required"),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.string().optional(),
  colour: z.string().optional(),
  vin: z.string().optional(),
  fleetType: z.enum(["electric", "lpg"]).default("electric"),
  telematicsVehicleId: z.string().optional(),
  telematicsEnabled: z.enum(["true", "false"]).default("false"),
  notes: z.string().optional(),
});

const PatchVehicleBody = z.object({
  registrationNumber: z.string().min(1).optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.string().optional(),
  colour: z.string().optional(),
  vin: z.string().optional(),
  fleetType: z.enum(["electric", "lpg"]).optional(),
  telematicsVehicleId: z.string().optional(),
  telematicsEnabled: z.enum(["true", "false"]).optional(),
  status: z.enum(["available", "assigned", "maintenance", "retired"]).optional(),
  notes: z.string().optional(),
}).strict();

const CreateAssignmentBody = z.object({
  vehicleId: z.string().min(1, "vehicleId is required"),
  driverProfileId: z.string().min(1, "driverProfileId is required"),
  assignmentStart: z.string().min(1, "assignmentStart is required"),
  assignmentEnd: z.string().min(1, "assignmentEnd is required"),
  shiftId: z.string().optional(),
  shiftAllocationId: z.string().optional(),
});

router.get("/v1/admin/vehicles", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const conditions: ReturnType<typeof eq>[] = [isNull(vehiclesTable.deletedAt) as unknown as ReturnType<typeof eq>];
  if (req.query.status) conditions.push(eq(vehiclesTable.status, req.query.status as string));
  if (req.query.fleetType) conditions.push(eq(vehiclesTable.fleetType, req.query.fleetType as string));

  const vehicles = await db.select().from(vehiclesTable).where(and(...conditions));
  res.json(ok(vehicles, { total: vehicles.length }));
});

router.post("/v1/admin/vehicles", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateVehicleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid request", data: null, meta: null });
    return;
  }

  const d = parsed.data;
  const vehicleId = newId();
  const [vehicle] = await db
    .insert(vehiclesTable)
    .values({
      id: vehicleId,
      registrationNumber: d.registrationNumber,
      make: d.make ?? null,
      model: d.model ?? null,
      year: d.year ?? null,
      colour: d.colour ?? null,
      vin: d.vin ?? null,
      fleetType: d.fleetType,
      telematicsVehicleId: d.telematicsVehicleId ?? null,
      telematicsEnabled: d.telematicsEnabled,
      notes: d.notes ?? null,
      status: "available",
      createdBy: req.userId!,
    })
    .returning();

  req.log.info({ vehicleId }, "Vehicle registered");
  res.status(201).json(ok(vehicle));
});

router.patch("/v1/admin/vehicles/:vehicleId", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.vehicleId) ? req.params.vehicleId[0] : req.params.vehicleId;

  const parsed = PatchVehicleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid request", data: null, meta: null });
    return;
  }

  const [existing] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, raw));
  if (!existing || existing.deletedAt) {
    res.status(404).json({ success: false, error: "Vehicle not found", data: null, meta: null });
    return;
  }

  const updates = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));
  const [updated] = await db.update(vehiclesTable).set(updates as never).where(eq(vehiclesTable.id, raw)).returning();
  res.json(ok(updated));
});

router.get("/v1/admin/vehicle-assignments", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const conditions: ReturnType<typeof eq>[] = [];
  if (req.query.status) conditions.push(eq(vehicleAssignmentsTable.status, req.query.status as string));
  if (req.query.shiftId) conditions.push(eq(vehicleAssignmentsTable.shiftId, req.query.shiftId as string));
  if (req.query.driverProfileId) conditions.push(eq(vehicleAssignmentsTable.driverProfileId, req.query.driverProfileId as string));

  let baseQuery = db
    .select({
      id: vehicleAssignmentsTable.id,
      vehicleId: vehicleAssignmentsTable.vehicleId,
      driverProfileId: vehicleAssignmentsTable.driverProfileId,
      shiftId: vehicleAssignmentsTable.shiftId,
      assignmentStart: vehicleAssignmentsTable.assignmentStart,
      assignmentEnd: vehicleAssignmentsTable.assignmentEnd,
      status: vehicleAssignmentsTable.status,
      lastUnlockAt: vehicleAssignmentsTable.lastUnlockAt,
      lastUnlockResult: vehicleAssignmentsTable.lastUnlockResult,
      registrationNumber: vehiclesTable.registrationNumber,
      make: vehiclesTable.make,
      model: vehiclesTable.model,
      year: vehiclesTable.year,
      fleetType: vehiclesTable.fleetType,
    })
    .from(vehicleAssignmentsTable)
    .leftJoin(vehiclesTable, eq(vehicleAssignmentsTable.vehicleId, vehiclesTable.id))
    .$dynamic();

  if (conditions.length > 0) baseQuery = baseQuery.where(and(...conditions));

  const assignments = await baseQuery;
  res.json(ok(assignments));
});

router.post("/v1/admin/vehicle-assignments", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateAssignmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid request", data: null, meta: null });
    return;
  }

  const d = parsed.data;

  const [vehicle] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, d.vehicleId));
  if (!vehicle) {
    res.status(404).json({ success: false, error: "Vehicle not found", data: null, meta: null });
    return;
  }

  const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.id, d.driverProfileId));
  if (!profile) {
    res.status(404).json({ success: false, error: "Driver not found", data: null, meta: null });
    return;
  }

  const assignmentId = newId();
  const [assignment] = await db
    .insert(vehicleAssignmentsTable)
    .values({
      id: assignmentId,
      vehicleId: d.vehicleId,
      driverProfileId: d.driverProfileId,
      userId: profile.userId,
      shiftId: d.shiftId ?? null,
      shiftAllocationId: d.shiftAllocationId ?? null,
      assignmentStart: new Date(d.assignmentStart),
      assignmentEnd: new Date(d.assignmentEnd),
      status: "active",
      assignedBy: req.userId!,
      telematicsSyncStatus: "not_synced",
    })
    .returning();

  if (profile.telematicsDriverId && vehicle.telematicsVehicleId) {
    telematics.createAssignment({
      vehicleAssignmentId: assignmentId,
      telematicsDriverId: profile.telematicsDriverId,
      telematicsVehicleId: vehicle.telematicsVehicleId,
      assignmentStart: new Date(d.assignmentStart),
      assignmentEnd: new Date(d.assignmentEnd),
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
  if (req.query.eventType) conditions.push(eq(vehicleAccessEventsTable.eventType, req.query.eventType as string));
  if (req.query.from) conditions.push(gte(vehicleAccessEventsTable.requestedAt, new Date(req.query.from as string)));
  if (req.query.to) conditions.push(lte(vehicleAccessEventsTable.requestedAt, new Date(req.query.to as string)));

  if (conditions.length > 0) query = query.where(and(...conditions));

  const events = await query;
  res.json(ok(events, { total: events.length }));
});

export default router;
