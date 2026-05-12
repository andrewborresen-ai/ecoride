import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, notificationsTable, usersTable } from "@workspace/db";
import { eq, isNotNull, desc } from "drizzle-orm";
import { requireAdmin } from "../../middlewares/auth";
import type { AuthenticatedRequest } from "../../middlewares/auth";
import { ok } from "../../lib/response";
import { newId } from "../../lib/ids";

const router: IRouter = Router();

const SendNotificationBody = z.object({
  userId: z.string().min(1, "userId is required"),
  title: z.string().min(1, "title is required"),
  body: z.string().min(1, "body is required"),
  type: z.string().default("general"),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
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
      status: "unread",
      sentBy: req.userId!,
    })
    .returning();

  req.log.info({ notificationId: notification.id, userId: d.userId }, "Notification sent");
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

export default router;
