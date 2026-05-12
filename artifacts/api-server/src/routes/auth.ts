import { Router, type IRouter } from "express";
import { z } from "zod";
import { getAuth } from "@clerk/express";
import { db, usersTable, driverProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { newId } from "../lib/ids";
import { ok } from "../lib/response";
import type { AuthenticatedRequest } from "../middlewares/auth";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const RegisterBody = z.object({
  email: z.string().email("Valid email required"),
});

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

  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid request", data: null, meta: null });
    return;
  }

  const { email } = parsed.data;

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
    .values({ id: userId, clerkId: auth.userId, email, role: "driver", status: "active" })
    .returning();

  const profileId = newId();
  const [profile] = await db
    .insert(driverProfilesTable)
    .values({ id: profileId, userId, email, status: "incomplete" })
    .returning();

  req.log.info({ userId }, "Driver registered");
  res.status(201).json(ok({ user, profile }));
});

export default router;
