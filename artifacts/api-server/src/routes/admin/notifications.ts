import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, notificationsTable, usersTable } from "@workspace/db";
import { eq, isNotNull, desc, and, lte } from "drizzle-orm";
import { requireAdmin } from "../../middlewares/auth";
import type { AuthenticatedRequest } from "../../middlewares/auth";
import { ok } from "../../lib/response";
import { newId } from "../../lib/ids";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

const SendNotificationBody = z.object({
  userId: z.string().min(1, "userId is required"),
  title: z.string().min(1, "title is required"),
  body: z.string().min(1, "body is required"),
  type: z.string().default("general"),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
  scheduledFor: z.string().optional(),
});

router.post("/v1/admin/notifications/send", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = SendNotificationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid request", data: null, meta: null });
    return;
  }

  const d = parsed.data;

  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, d.userId));
  if (!targetUser) {
    res.status(404).json({ success: false, error: "Target user not found", data: null, meta: null });
    return;
  }

  const scheduledAt = d.scheduledFor ? new Date(d.scheduledFor) : null;
  const isScheduled = scheduledAt && scheduledAt > new Date();

  const [notification] = await db
    .insert(notificationsTable)
    .values({
      id: newId(),
      userId: d.userId,
      title: d.title,
      body: d.body,
      type: d.type,
      referenceType: d.referenceType ?? null,
      referenceId: d.referenceId ?? null,
      status: isScheduled ? "pending_delivery" : "unread",
      scheduledFor: scheduledAt,
      sentBy: req.userId!,
    })
    .returning();

  req.log.info({ notificationId: notification.id, userId: d.userId, scheduled: isScheduled }, "Notification queued");
  res.status(201).json(ok(notification));
});

router.get("/v1/admin/notifications/sent", requireAdmin, async (_req: AuthenticatedRequest, res): Promise<void> => {
  const sent = await db
    .select()
    .from(notificationsTable)
    .where(isNotNull(notificationsTable.sentBy))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(200);
  res.json(ok(sent, { total: sent.length }));
});

// Background scheduler: deliver pending_delivery notifications whose scheduledFor has passed
async function deliverScheduledNotifications(): Promise<void> {
  try {
    const now = new Date();
    const pending = await db
      .select()
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.status, "pending_delivery"),
          lte(notificationsTable.scheduledFor, now)
        )
      );

    if (pending.length === 0) return;

    for (const n of pending) {
      await db
        .update(notificationsTable)
        .set({ status: "unread", scheduledFor: null })
        .where(eq(notificationsTable.id, n.id));
    }

    logger.info({ delivered: pending.length }, "Scheduled notifications delivered");
  } catch (err) {
    logger.error({ err }, "Failed to deliver scheduled notifications");
  }
}

// Run immediately on startup, then every 60 seconds
void deliverScheduledNotifications();
setInterval(() => { void deliverScheduledNotifications(); }, 60_000);

export default router;
