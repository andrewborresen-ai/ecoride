import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, vehicleAccessEventsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { ok } from "../lib/response";
import { receiveCallback } from "../integrations/telematics";

const router: IRouter = Router();

const TelematicsWebhookBody = z.object({
  eventType: z.string().min(1),
  vehicleAccessEventId: z.string().optional(),
  telematicsRequestId: z.string().optional(),
  result: z.enum(["pass", "fail"]).optional(),
  message: z.string().optional(),
  timestamp: z.string().optional(),
});

router.post("/v1/webhooks/telematics", async (req, res): Promise<void> => {
  const parsed = TelematicsWebhookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid webhook payload", data: null, meta: null });
    return;
  }

  const { eventType, vehicleAccessEventId, telematicsRequestId, result, message, timestamp } = parsed.data;

  logger.info({ eventType, vehicleAccessEventId, telematicsRequestId }, "Telematics webhook received");

  if (vehicleAccessEventId) {
    const biometricResult = result ?? null;
    const resolvedStatus = biometricResult === "pass" ? "success" : biometricResult === "fail" ? "failed" : "resolved";

    const callbackResult = receiveCallback({
      accessEventId: vehicleAccessEventId,
      assignmentId: "",
      driverId: "",
      vehicleId: "",
      status: biometricResult === "pass" ? "passed" : "failed",
      failureReason: message,
      timestamp,
    });

    await db
      .update(vehicleAccessEventsTable)
      .set({
        telematicsRequestId: telematicsRequestId ?? null,
        telematicsResponseMessage: message ?? null,
        biometricResult,
        eventStatus: resolvedStatus,
        status: resolvedStatus,
        resolvedAt: timestamp ? new Date(timestamp) : new Date(),
      })
      .where(eq(vehicleAccessEventsTable.id, vehicleAccessEventId));

    logger.info({ callbackResult }, "Telematics callback processed");
  }

  res.json(ok({ acknowledged: true }));
});

export default router;
