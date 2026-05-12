import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable, driverProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { newId } from "../lib/ids";
import { ok } from "../lib/response";
import type { AuthenticatedRequest } from "../middlewares/auth";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/v1/auth/me", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user) {
    res.status(404).json({ success: false, error: "User not found", data: null, meta: null });
    return;
  }
  let profile = null;
  if (user.role === "driver") {
    const [p] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, user.id));
    profile = p ?? null;
  }
  res.json(ok({ user, profile }));
});

router.post("/v1/auth/register", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ success: false, error: "Unauthorized", data: null, meta: null });
    return;
  }

  const { email, role = "driver" } = req.body;

  if (!email) {
    res.status(400).json({ success: false, error: "email is required", data: null, meta: null });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.clerkId, auth.userId));
  if (existing.length > 0) {
    const [user] = existing;
    let profile = null;
    if (user.role === "driver") {
      const [p] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, user.id));
      profile = p ?? null;
    }
    res.status(200).json(ok({ user, profile }));
    return;
  }

  const userId = newId();
  const [user] = await db
    .insert(usersTable)
    .values({ id: userId, clerkId: auth.userId, email, role, status: "active" })
    .returning();

  let profile = null;
  if (role === "driver") {
    const profileId = newId();
    const [p] = await db
      .insert(driverProfilesTable)
      .values({ id: profileId, userId, email, status: "incomplete" })
      .returning();
    profile = p;
  }

  req.log.info({ userId }, "User registered");
  res.status(201).json(ok({ user, profile }));
});

export default router;
