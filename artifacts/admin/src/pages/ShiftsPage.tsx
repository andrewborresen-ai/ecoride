import { useState } from "react";
import {
  useAdminListShifts,
  useAdminCreateShift,
  useAdminUpdateShift,
  getAdminListShiftsQueryKey,
} from "@workspace/api-client-react";
import type { ShiftInput, ShiftUpdate } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, X, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Link } from "wouter";
import { Label } from "@/components/ui/label";

interface ShiftItem {
  id: string;
  title?: string;
  description?: string;
  fleetType?: string;
  startTime: string;
  endTime: string;
  capacity?: number;
  confirmedCount?: number;
  status?: string;
}


function toLocalDatetime(isoString: string) {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ShiftsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ShiftItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [closeTarget, setCloseTarget] = useState<{ id: string; action: "closed" | "cancelled" } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shiftsRes, isLoading } = useAdminListShifts({
    status: statusFilter !== "all" ? statusFilter : undefined,
  });
  const shifts = (shiftsRes?.data as ShiftItem[] | undefined) ?? [];

  const createShift = useAdminCreateShift();
  const updateShift = useAdminUpdateShift();

  const [newShift, setNewShift] = useState({
    title: "", description: "", fleetType: "electric",
    startTime: "", endTime: "", capacity: "10",
  });
  const [editForm, setEditForm] = useState<ShiftUpdate>({});

  const handleCreate = () => {
    if (!newShift.title || !newShift.startTime || !newShift.endTime) {
      toast({ title: "Required fields missing", variant: "destructive" }); return;
    }
    const data: ShiftInput = {
      title: newShift.title,
      description: newShift.description || undefined,
      fleetType: newShift.fleetType,
      startTime: new Date(newShift.startTime).toISOString(),
      endTime: new Date(newShift.endTime).toISOString(),
      capacity: Number(newShift.capacity),
    };
    createShift.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "Shift created" });
        setCreateOpen(false);
        setNewShift({ title: "", description: "", fleetType: "electric", startTime: "", endTime: "", capacity: "10" });
        queryClient.invalidateQueries({ queryKey: getAdminListShiftsQueryKey({}) });
      },
      onError: (err) => toast({ title: "Error creating shift", description: err.message, variant: "destructive" }),
    });
  };

  const handleUpdate = () => {
    if (!editTarget) return;
    updateShift.mutate({ shiftId: editTarget.id, data: editForm }, {
      onSuccess: () => {
        toast({ title: "Shift updated" });
        setEditTarget(null);
        queryClient.invalidateQueries({ queryKey: getAdminListShiftsQueryKey({}) });
      },
      onError: (err) => toast({ title: "Error updating shift", description: err.message, variant: "destructive" }),
    });
  };

  const handleStatusChange = (shiftId: string, status: "closed" | "cancelled") => {
    updateShift.mutate({ shiftId, data: { status } }, {
      onSuccess: () => {
        toast({ title: `Shift ${status}` });
        setCloseTarget(null);
        queryClient.invalidateQueries({ queryKey: getAdminListShiftsQueryKey({}) });
      },
      onError: (err) => toast({ title: "Error updating shift", description: err.message, variant: "destructive" }),
    });
  };

  const STATUS_COLOR: Record<string, string> = {
    open: "bg-green-100 text-green-800",
    full: "bg-blue-100 text-blue-800",
    closed: "bg-gray-100 text-gray-700",
    cancelled: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Confirm close/cancel dialog */}
      <AlertDialog open={!!closeTarget} onOpenChange={(o) => { if (!o) setCloseTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {closeTarget?.action === "cancelled" ? "Cancel Shift" : "Close Shift"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {closeTarget?.action === "cancelled"
                ? "This will cancel the shift and notify all allocated drivers. This cannot be undone."
                : "Closing the shift prevents new requests. Existing confirmed allocations are unaffected."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction
              className={closeTarget?.action === "cancelled" ? "bg-red-600 hover:bg-red-700" : ""}
              onClick={() => closeTarget && handleStatusChange(closeTarget.id, closeTarget.action)}
            >
              Confirm {closeTarget?.action === "cancelled" ? "Cancel" : "Close"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Shift — {editTarget?.title}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={editForm.title ?? editTarget?.title ?? ""} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={editForm.description ?? editTarget?.description ?? ""} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Start Time</Label>
                <Input
                  type="datetime-local"
                  value={editForm.startTime ? toLocalDatetime(editForm.startTime) : (editTarget?.startTime ? toLocalDatetime(editTarget.startTime) : "")}
                  onChange={(e) => setEditForm({ ...editForm, startTime: new Date(e.target.value).toISOString() })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End Time</Label>
                <Input
                  type="datetime-local"
                  value={editForm.endTime ? toLocalDatetime(editForm.endTime) : (editTarget?.endTime ? toLocalDatetime(editTarget.endTime) : "")}
                  onChange={(e) => setEditForm({ ...editForm, endTime: new Date(e.target.value).toISOString() })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Capacity</Label>
              <Input
                type="number" min="1"
                value={editForm.capacity ?? editTarget?.capacity ?? ""}
                onChange={(e) => setEditForm({ ...editForm, capacity: Number(e.target.value) })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={updateShift.isPending} className="bg-[#3DB324] hover:bg-[#329b1d]">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1C2126] tracking-tight">Shifts</h1>
          <p className="text-gray-500">Create, edit, and manage shift schedules.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#3DB324] hover:bg-[#329b1d]" data-testid="btn-add-shift">
              <Plus className="mr-2 h-4 w-4" /> Create Shift
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create New Shift</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label>Title *</Label>
                <Input value={newShift.title} onChange={(e) => setNewShift({ ...newShift, title: e.target.value })} placeholder="e.g. Morning Shift — Zone A" />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input value={newShift.description} onChange={(e) => setNewShift({ ...newShift, description: e.target.value })} placeholder="Optional briefing notes..." />
              </div>
              <div className="space-y-1.5">
                <Label>Fleet Type</Label>
                <Select value={newShift.fleetType} onValueChange={(v) => setNewShift({ ...newShift, fleetType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="electric">Electric (EcoRide)</SelectItem>
                    <SelectItem value="lpg">LPG (Khula Rides)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Start Time *</Label>
                  <Input type="datetime-local" value={newShift.startTime} onChange={(e) => setNewShift({ ...newShift, startTime: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>End Time *</Label>
                  <Input type="datetime-local" value={newShift.endTime} onChange={(e) => setNewShift({ ...newShift, endTime: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Capacity</Label>
                <Input type="number" min="1" value={newShift.capacity} onChange={(e) => setNewShift({ ...newShift, capacity: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createShift.isPending} className="bg-[#3DB324] hover:bg-[#329b1d]">Create Shift</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="full">Full</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Fleet</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    {Array(6).fill(0).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>)}
                  </TableRow>
                ))
              ) : shifts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">No shifts found.</TableCell>
                </TableRow>
              ) : (
                shifts.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      <Link href={`/shifts/${s.id}`} className="text-[#3DB324] hover:underline">{s.title}</Link>
                    </TableCell>
                    <TableCell className="capitalize">{s.fleetType ?? "—"}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {format(new Date(s.startTime), "MMM d, HH:mm")} – {format(new Date(s.endTime), "HH:mm")}
                    </TableCell>
                    <TableCell>
                      <span className={`font-medium ${(s.confirmedCount ?? 0) >= (s.capacity ?? Infinity) ? "text-orange-600" : ""}`}>
                        {s.confirmedCount ?? 0}
                      </span>
                      {" / "}
                      {s.capacity ?? "—"}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[s.status ?? ""] ?? "bg-gray-100 text-gray-700"}`}>
                        {s.status ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {(s.status === "open" || s.status === "full") && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => { setEditTarget(s); setEditForm({}); }}
                              data-testid={`btn-edit-shift-${s.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setCloseTarget({ id: s.id, action: "closed" })}
                              title="Close shift"
                            >
                              <Lock className="h-4 w-4 text-gray-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setCloseTarget({ id: s.id, action: "cancelled" })}
                              title="Cancel shift"
                            >
                              <X className="h-4 w-4 text-red-500" />
                            </Button>
                          </>
                        )}
                      </div>
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
