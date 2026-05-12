import { Router, type IRouter } from "express";
import { db, notificationsTable } from "@workspace/db";
import { requireAdmin } from "../../middlewares/auth";
import type { AuthenticatedRequest } from "../../middlewares/auth";
import { ok } from "../../lib/response";
import { newId } from "../../lib/ids";

const router: IRouter = Router();

router.post("/v1/admin/notifications/send", requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { userId, title, body, type, referenceType, referenceId } = req.body;

  if (!userId || !title || !body) {
    res.status(400).json({ success: false, error: "userId, title, body required", data: null, meta: null });
    return;
  }

  const [notification] = await db
    .insert(notificationsTable)
    .values({
      id: newId(),
      userId,
      title,
      body,
      type: type ?? "general",
      referenceType: referenceType ?? null,
      referenceId: referenceId ?? null,
      status: "unread",
      sentBy: req.userId!,
    })
    .returning();

  req.log.info({ notificationId: notification.id, userId }, "Notification sent");
  res.status(201).json(ok(notification));
});

export default router;
