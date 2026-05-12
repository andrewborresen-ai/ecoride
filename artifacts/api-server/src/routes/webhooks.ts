import { Router, type IRouter, type Request } from "express";
import { z } from "zod";
import { db, vehicleAccessEventsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { ok } from "../lib/response";
import { receiveCallback } from "../integrations/telematics";
import { createHmac, timingSafeEqual } from "crypto";

const router: IRouter = Router();

const WEBHOOK_SECRET = process.env.TELEMATICS_WEBHOOK_SECRET ?? "";

function verifyWebhookSignature(req: Request): boolean {
  if (!WEBHOOK_SECRET) {
    logger.warn("TELEMATICS_WEBHOOK_SECRET not configured — rejecting all webhook requests");
    return false;
  }

  const signature = req.headers["x-telematics-signature"] as string | undefined;
  if (!signature) {
    return false;
  }

  const rawBody: Buffer | undefined = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!rawBody) {
    logger.warn("Raw body not available for webhook signature verification");
    return false;
  }

  const expectedSig = "sha256=" + createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");

  try {
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length) return false;
    return timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

const TelematicsWebhookBody = z.object({
  eventType: z.string().min(1),
  vehicleAccessEventId: z.string().optional(),
  telematicsRequestId: z.string().optional(),
  result: z.enum(["pass", "fail"]).optional(),
  message: z.string().optional(),
  timestamp: z.string().optional(),
});

router.post("/v1/webhooks/telematics", async (req, res): Promise<void> => {
  if (!verifyWebhookSignature(req)) {
    logger.warn({ ip: req.ip }, "Telematics webhook rejected — invalid or missing signature");
    res.status(401).json({ success: false, error: "Invalid webhook signature", data: null, meta: null });
    return;
  }

  const parsed = TelematicsWebhookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid webhook payload", data: null, meta: null });
    return;
  }

  const { eventType, vehicleAccessEventId, telematicsRequestId, result, message, timestamp } = parsed.data;

  logger.info({ eventType, vehicleAccessEventId, telematicsRequestId }, "Telematics webhook verified and received");

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
