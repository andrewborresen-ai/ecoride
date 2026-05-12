import { Router, type IRouter } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../../middlewares/auth";
import type { AuthenticatedRequest } from "../../middlewares/auth";
import { ok } from "../../lib/response";

const router: IRouter = Router();

router.get("/v1/drivers/me/notifications", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const conditions = [eq(notificationsTable.userId, req.userId!)];
  if (req.query.status) conditions.push(eq(notificationsTable.status, req.query.status as string));

  const notifications = await db
    .select()
    .from(notificationsTable)
    .where(and(...conditions));
  res.json(ok(notifications));
});

router.patch("/v1/drivers/me/notifications/:notificationId/read", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.notificationId) ? req.params.notificationId[0] : req.params.notificationId;

  const [notification] = await db
    .select()
    .from(notificationsTable)
    .where(and(eq(notificationsTable.id, raw), eq(notificationsTable.userId, req.userId!)));

  if (!notification) {
    res.status(404).json({ success: false, error: "Notification not found", data: null, meta: null });
    return;
  }

  const [updated] = await db
    .update(notificationsTable)
    .set({ status: "read", readAt: new Date() })
    .where(eq(notificationsTable.id, raw))
    .returning();

  res.json(ok(updated));
});

export default router;
