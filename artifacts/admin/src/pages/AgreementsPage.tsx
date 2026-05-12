import { useState } from "react";
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
import { Plus, CheckCircle, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Label } from "@/components/ui/label";

interface AgreementItem {
  id: string;
  title: string;
  version: string;
  fleetType?: string;
  isActive?: boolean;
  content?: string;
  createdAt: string;
}

interface AgreementsData {
  items: AgreementItem[];
}

const EMPTY: AgreementInput = { title: "", version: "", content: "", fleetType: "electric" };

export default function AgreementsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AgreementItem | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: agreementsRes, isLoading } = useAdminListAgreements();
  const agreements = (agreementsRes?.data as AgreementsData | undefined)?.items ?? [];

  const createAgreement = useAdminCreateAgreement();
  const updateAgreement = useAdminUpdateAgreement();
  const activateAgreement = useAdminActivateAgreement();

  const [newAgreement, setNewAgreement] = useState<AgreementInput>(EMPTY);
  const [editForm, setEditForm] = useState<AgreementUpdate>({});

  const handleCreate = () => {
    if (!newAgreement.title || !newAgreement.content || !newAgreement.version) {
      toast({ title: "All fields required", variant: "destructive" }); return;
    }
    createAgreement.mutate({ data: newAgreement }, {
      onSuccess: () => {
        toast({ title: "Agreement created" });
        setCreateOpen(false);
        setNewAgreement(EMPTY);
        queryClient.invalidateQueries({ queryKey: getAdminListAgreementsQueryKey() });
      },
      onError: (err) => toast({ title: "Error creating agreement", description: err.message, variant: "destructive" }),
    });
  };

  const handleUpdate = () => {
    if (!editTarget) return;
    updateAgreement.mutate({ agreementId: editTarget.id, data: editForm }, {
      onSuccess: () => {
        toast({ title: "Agreement updated" });
        setEditTarget(null);
        queryClient.invalidateQueries({ queryKey: getAdminListAgreementsQueryKey() });
      },
      onError: (err) => toast({ title: "Error updating agreement", description: err.message, variant: "destructive" }),
    });
  };

  const handleActivate = (id: string) => {
    activateAgreement.mutate({ agreementId: id }, {
      onSuccess: () => {
        toast({ title: "Agreement activated" });
        queryClient.invalidateQueries({ queryKey: getAdminListAgreementsQueryKey() });
      },
      onError: (err) => toast({ title: "Error activating agreement", description: err.message, variant: "destructive" }),
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
          <DialogContent className="max-w-3xl">
            <DialogHeader><DialogTitle>Create New Agreement Version</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <Label>Title</Label>
                  <Input value={newAgreement.title} onChange={(e) => setNewAgreement({ ...newAgreement, title: e.target.value })} placeholder="e.g. Master Services Agreement" />
                </div>
                <div className="space-y-1.5">
                  <Label>Version</Label>
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
                    <SelectItem value="all">All Fleets</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Content (Markdown / Plain Text)</Label>
                <Textarea className="h-64 font-mono text-sm" value={newAgreement.content} onChange={(e) => setNewAgreement({ ...newAgreement, content: e.target.value })} placeholder="Paste the full agreement text here..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createAgreement.isPending} className="bg-[#3DB324] hover:bg-[#329b1d]">Save Agreement</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Edit Agreement — {editTarget?.title}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={editForm.title ?? editTarget?.title ?? ""} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Content</Label>
              <Textarea className="h-64 font-mono text-sm" value={editForm.content ?? editTarget?.content ?? ""} onChange={(e) => setEditForm({ ...editForm, content: e.target.value })} />
            </div>
            <p className="text-xs text-gray-400">Note: Version and fleet type cannot be changed after creation. Create a new version for those changes.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
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
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(3).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    {Array(6).fill(0).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>)}
                  </TableRow>
                ))
              ) : agreements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">No agreements found.</TableCell>
                </TableRow>
              ) : (
                agreements.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.title}</TableCell>
                    <TableCell><Badge variant="outline">{a.version}</Badge></TableCell>
                    <TableCell className="capitalize">{a.fleetType ?? "—"}</TableCell>
                    <TableCell className="text-sm text-gray-500">{format(new Date(a.createdAt), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <Badge variant={a.isActive ? "default" : "secondary"} className={a.isActive ? "bg-[#3DB324] hover:bg-[#3DB324]" : ""}>
                        {a.isActive ? "Active" : "Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setEditTarget(a); setEditForm({ title: a.title, content: a.content ?? "" }); }}
                        data-testid={`btn-edit-agreement-${a.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {!a.isActive && (
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
