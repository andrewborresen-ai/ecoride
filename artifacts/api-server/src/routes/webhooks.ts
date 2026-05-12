import { Router, type IRouter } from "express";
import { db, vehicleAccessEventsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { ok } from "../lib/response";

const router: IRouter = Router();

router.post("/v1/webhooks/telematics", async (req, res): Promise<void> => {
  const { eventType, vehicleAccessEventId, telematicsRequestId, result, message, timestamp } = req.body;

  logger.info({ eventType, vehicleAccessEventId, telematicsRequestId }, "Telematics webhook received");

  if (vehicleAccessEventId) {
    const biometricResult = result ?? null;
    const resolvedStatus = biometricResult === "pass" ? "success" : biometricResult === "fail" ? "failed" : "resolved";

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
  }

  res.json(ok({ acknowledged: true }));
});

export default router;
