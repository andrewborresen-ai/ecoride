import { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  clerkUserId?: string;
  userRole?: string;
  driverProfileId?: string;
}

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ success: false, error: "Unauthorized", data: null, meta: null });
    return;
  }
  req.clerkUserId = auth.userId;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, auth.userId));

  if (!user) {
    res.status(401).json({ success: false, error: "User not found", data: null, meta: null });
    return;
  }

  req.userId = user.id;
  req.userRole = user.role;
  next();
};

export const requireAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  await requireAuth(req, res, async () => {
    if (req.userRole !== "admin") {
      res.status(403).json({ success: false, error: "Forbidden", data: null, meta: null });
      return;
    }
    next();
  });
};

export const requireDriver = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  await requireAuth(req, res, async () => {
    if (req.userRole !== "driver") {
      res.status(403).json({ success: false, error: "Forbidden", data: null, meta: null });
      return;
    }
    next();
  });
};
