import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, driverProfilesTable, driverDocumentsTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { requireAuth } from "../../middlewares/auth";
import type { AuthenticatedRequest } from "../../middlewares/auth";
import { ok } from "../../lib/response";
import { newId } from "../../lib/ids";
import { ObjectStorageService } from "../../lib/objectStorage";

const router: IRouter = Router();
const storage = new ObjectStorageService();

const UploadBody = z.object({
  name: z.string().min(1, "name is required"),
  size: z.number().int().positive("size must be a positive integer"),
  contentType: z.string().min(1, "contentType is required"),
});

const CreateDocumentBody = z.object({
  documentType: z.string().min(1, "documentType is required"),
  objectPath: z.string().min(1, "objectPath is required"),
  fileName: z.string().optional(),
  mimeType: z.string().optional(),
  fileSizeBytes: z.number().int().positive().optional(),
});

async function getUploadUrl(req: AuthenticatedRequest, res: Parameters<Parameters<typeof router.post>[1]>[1]): Promise<void> {
  const parsed = UploadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid request", data: null, meta: null });
    return;
  }
  const uploadURL = await storage.getObjectEntityUploadURL();
  const objectPath = storage.normalizeObjectEntityPath(uploadURL);
  res.json(ok({ uploadURL, objectPath }));
}

router.post("/v1/drivers/me/documents/upload-url", requireAuth, getUploadUrl);
router.post("/v1/drivers/me/documents/upload", requireAuth, getUploadUrl);

router.get("/v1/drivers/me/documents", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, req.userId!));
  if (!profile) {
    res.status(404).json({ success: false, error: "Profile not found", data: null, meta: null });
    return;
  }
  const docs = await db
    .select()
    .from(driverDocumentsTable)
    .where(and(eq(driverDocumentsTable.driverProfileId, profile.id), isNull(driverDocumentsTable.deletedAt)));
  res.json(ok(docs));
});

router.post("/v1/drivers/me/documents", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, req.userId!));
  if (!profile) {
    res.status(404).json({ success: false, error: "Profile not found", data: null, meta: null });
    return;
  }

  const parsed = CreateDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid request", data: null, meta: null });
    return;
  }

  const { documentType, objectPath, fileName, mimeType, fileSizeBytes } = parsed.data;

  const [doc] = await db
    .insert(driverDocumentsTable)
    .values({
      id: newId(),
      driverProfileId: profile.id,
      userId: req.userId!,
      documentType,
      objectPath,
      fileName: fileName ?? null,
      mimeType: mimeType ?? null,
      fileSizeBytes: fileSizeBytes ?? null,
      status: "pending",
    })
    .returning();

  req.log.info({ documentId: doc.id, documentType }, "Driver document recorded");
  res.status(201).json(ok(doc));
});

router.delete("/v1/drivers/me/documents/:documentId", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.documentId) ? req.params.documentId[0] : req.params.documentId;
  const [doc] = await db
    .select()
    .from(driverDocumentsTable)
    .where(and(eq(driverDocumentsTable.id, raw), eq(driverDocumentsTable.userId, req.userId!)));

  if (!doc) {
    res.status(404).json({ success: false, error: "Document not found", data: null, meta: null });
    return;
  }

  await db
    .update(driverDocumentsTable)
    .set({ deletedAt: new Date() })
    .where(eq(driverDocumentsTable.id, raw));

  req.log.info({ documentId: raw }, "Driver document soft-deleted");
  res.sendStatus(204);
});

export default router;
