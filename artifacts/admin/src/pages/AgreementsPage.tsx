import { useState, useRef } from "react";
import { useAuth } from "@clerk/react";
import {
  useAdminListAgreements,
  useAdminCreateAgreement,
  useAdminUpdateAgreement,
  useAdminActivateAgreement,
  getAdminListAgreementsQueryKey,
} from "@workspace/api-client-react";
import type { AgreementInput, AgreementUpdate } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, CheckCircle, Pencil, Upload, FileText, Loader2, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Label } from "@/components/ui/label";

interface AgreementItem {
  id: string;
  title: string;
  version: string;
  fleetType?: string;
  status?: string;
  content?: string;
  pdfPath?: string | null;
  createdAt: string;
}

const EMPTY: AgreementInput = { title: "", version: "", content: "", fleetType: "electric" };

function PdfUploadSection({
  currentPdfPath,
  onUploaded,
}: {
  currentPdfPath?: string | null;
  onUploaded: (objectPath: string) => void;
}) {
  const { getToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedPath, setUploadedPath] = useState<string | null>(currentPdfPath ?? null);
  const { toast } = useToast();

  const handleFile = async (file: File) => {
    if (!file.type.includes("pdf")) {
      toast({ title: "Please select a PDF file", variant: "destructive" }); return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "File too large (max 20 MB)", variant: "destructive" }); return;
    }
    setUploading(true);
    try {
      const token = await getToken();
      const urlRes = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = (await urlRes.json()) as { uploadURL: string; objectPath: string };
      await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      setUploadedPath(objectPath);
      onUploaded(objectPath);
      toast({ title: "PDF uploaded successfully" });
    } catch (err) {
      toast({ title: "Upload failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> PDF Document (optional)</Label>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
      />
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {uploading ? "Uploading…" : uploadedPath ? "Replace PDF" : "Upload PDF"}
        </Button>
        {uploadedPath && (
          <span className="text-xs text-[#3DB324] flex items-center gap-1">
            <CheckCircle className="h-3.5 w-3.5" /> PDF attached
          </span>
        )}
      </div>
      <p className="text-xs text-gray-400">Accepted: PDF only. Max 20 MB.</p>
    </div>
  );
}

export default function AgreementsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AgreementItem | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: agreementsRes, isLoading } = useAdminListAgreements();
  const agreements = (agreementsRes?.data as AgreementItem[] | undefined) ?? [];

  const createAgreement = useAdminCreateAgreement();
  const updateAgreement = useAdminUpdateAgreement();
  const activateAgreement = useAdminActivateAgreement();

  const [newAgreement, setNewAgreement] = useState<AgreementInput>(EMPTY);
  const [newPdfPath, setNewPdfPath] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<AgreementUpdate>({});
  const [editPdfPath, setEditPdfPath] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getAdminListAgreementsQueryKey() });

  const handleCreate = () => {
    if (!newAgreement.title || !newAgreement.content || !newAgreement.version) {
      toast({ title: "All fields required", variant: "destructive" }); return;
    }
    const data = { ...newAgreement, ...(newPdfPath ? { pdfPath: newPdfPath } : {}) };
    createAgreement.mutate({ data: data as AgreementInput }, {
      onSuccess: () => {
        toast({ title: "Agreement created" });
        setCreateOpen(false);
        setNewAgreement(EMPTY);
        setNewPdfPath(null);
        invalidate();
      },
      onError: (err) => toast({ title: "Error creating agreement", description: err.message, variant: "destructive" }),
    });
  };

  const handleUpdate = () => {
    if (!editTarget) return;
    const data = { ...editForm, ...(editPdfPath !== null ? { pdfPath: editPdfPath } : {}) };
    updateAgreement.mutate({ agreementId: editTarget.id, data: data as AgreementUpdate }, {
      onSuccess: () => {
        toast({ title: "Agreement updated" });
        setEditTarget(null);
        setEditPdfPath(null);
        invalidate();
      },
      onError: (err) => toast({ title: "Error updating agreement", description: err.message, variant: "destructive" }),
    });
  };

  const handleActivate = (id: string) => {
    activateAgreement.mutate({ agreementId: id }, {
      onSuccess: () => { toast({ title: "Agreement activated" }); invalidate(); },
      onError: (err) => toast({ title: "Error activating", description: err.message, variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#1C2126] tracking-tight">Agreements</h1>
          <p className="text-gray-500">Manage legal terms, versions, and activation.</p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#3DB324] hover:bg-[#329b1d]">
              <Plus className="mr-2 h-4 w-4" /> New Version
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create New Agreement Version</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <Label>Title *</Label>
                  <Input value={newAgreement.title} onChange={(e) => setNewAgreement({ ...newAgreement, title: e.target.value })} placeholder="e.g. Master Services Agreement" />
                </div>
                <div className="space-y-1.5">
                  <Label>Version *</Label>
                  <Input value={newAgreement.version} onChange={(e) => setNewAgreement({ ...newAgreement, version: e.target.value })} placeholder="e.g. v2.1" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Fleet Type</Label>
                <Select value={newAgreement.fleetType ?? "electric"} onValueChange={(v) => setNewAgreement({ ...newAgreement, fleetType: v })}>
                  <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="electric">Electric (EcoRide)</SelectItem>
                    <SelectItem value="lpg">LPG (Khula Rides)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Content — rich text / markdown *</Label>
                <Textarea
                  className="h-64 font-mono text-sm"
                  value={newAgreement.content}
                  onChange={(e) => setNewAgreement({ ...newAgreement, content: e.target.value })}
                  placeholder="Paste the full agreement text here. Supports Markdown formatting (# headings, **bold**, _italic_, lists, etc.)."
                />
                <p className="text-xs text-gray-400">Rendered for drivers as formatted rich text. Supports Markdown.</p>
              </div>
              <PdfUploadSection onUploaded={(path) => setNewPdfPath(path)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setCreateOpen(false); setNewPdfPath(null); }}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createAgreement.isPending} className="bg-[#3DB324] hover:bg-[#329b1d]">Save Agreement</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) { setEditTarget(null); setEditPdfPath(null); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Agreement — {editTarget?.title}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={editForm.title ?? editTarget?.title ?? ""} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Content — rich text / markdown</Label>
              <Textarea
                className="h-64 font-mono text-sm"
                value={editForm.content ?? editTarget?.content ?? ""}
                onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                placeholder="Supports Markdown: # headings, **bold**, _italic_, lists…"
              />
              <p className="text-xs text-gray-400">Rendered for drivers as formatted rich text. Supports Markdown.</p>
            </div>
            <PdfUploadSection
              currentPdfPath={editTarget?.pdfPath}
              onUploaded={(path) => setEditPdfPath(path)}
            />
            <p className="text-xs text-gray-400">Version and fleet type cannot be changed after creation. Create a new version for those changes.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditTarget(null); setEditPdfPath(null); }}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={updateAgreement.isPending} className="bg-[#3DB324] hover:bg-[#329b1d]">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Fleet Type</TableHead>
                <TableHead>PDF</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(3).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    {Array(7).fill(0).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>)}
                  </TableRow>
                ))
              ) : agreements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">No agreements found.</TableCell>
                </TableRow>
              ) : (
                agreements.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.title}</TableCell>
                    <TableCell><Badge variant="outline">{a.version}</Badge></TableCell>
                    <TableCell className="capitalize">{a.fleetType ?? "—"}</TableCell>
                    <TableCell>
                      {a.pdfPath ? (
                        <a
                          href={`/api/storage/objects/${a.pdfPath}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-[#3DB324] hover:underline"
                        >
                          <FileText className="h-3.5 w-3.5" /> View PDF <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">No PDF</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">{format(new Date(a.createdAt), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <Badge variant={a.status === "active" ? "default" : "secondary"} className={a.status === "active" ? "bg-[#3DB324] hover:bg-[#3DB324]" : ""}>
                        {a.status === "active" ? "Active" : a.status === "archived" ? "Archived" : "Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setEditTarget(a); setEditForm({ title: a.title, content: a.content ?? "" }); setEditPdfPath(null); }}
                        data-testid={`btn-edit-agreement-${a.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {a.status !== "active" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleActivate(a.id)}
                          disabled={activateAgreement.isPending}
                        >
                          <CheckCircle className="mr-2 h-4 w-4" /> Activate
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
