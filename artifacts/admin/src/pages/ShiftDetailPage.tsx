import { useState } from "react";
import { useRoute } from "wouter";
import {
  useAdminListShifts,
  useAdminUpdateShift,
  useAdminGetShiftAllocations,
  useAdminConfirmAllocation,
  useAdminDeclineAllocation,
  useAdminListVehicles,
  useAdminCreateVehicleAssignment,
  getAdminGetShiftAllocationsQueryKey,
  getAdminListShiftsQueryKey,
} from "@workspace/api-client-react";
import type { DeclineAllocationInput, VehicleAssignmentInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminApi } from "@/lib/adminApi";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Check, X, ArrowUp, Lock } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ShiftItem {
  id: string;
  title?: string;
  startTime: string;
  endTime: string;
  capacity?: number;
  confirmedCount?: number;
  fleetType?: string;
  status?: string;
}

interface AllocationItem {
  id: string;
  driverProfileId: string;
  status: string;
  vehicleAssignmentId?: string;
  telematicsSyncStatus?: string;
}

interface VehicleItem {
  id: string;
  registrationNumber: string;
  make?: string;
  model?: string;
}

interface ListData<T> {
  items: T[];
}

export default function ShiftDetailPage() {
  const [, params] = useRoute("/shifts/:id");
  const shiftId = params?.id ?? "";
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("requested");
  const [declineTarget, setDeclineTarget] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  const { data: shiftsRes } = useAdminListShifts({});
  const allShifts = (shiftsRes?.data as ListData<ShiftItem> | undefined)?.items ?? [];
  const shift = allShifts.find((s) => s.id === shiftId);

  const { data: allocsRes, isLoading: loadingAllocs } = useAdminGetShiftAllocations(shiftId);
  const allocations = (allocsRes?.data as ListData<AllocationItem> | undefined)?.items ?? [];

  const { data: vehiclesRes } = useAdminListVehicles({ status: "active" });
  const vehicles = (vehiclesRes?.data as ListData<VehicleItem> | undefined)?.items ?? [];

  const { waitlistAllocation } = useAdminApi();
  const confirmAlloc = useAdminConfirmAllocation();
  const declineAlloc = useAdminDeclineAllocation();
  const assignVehicle = useAdminCreateVehicleAssignment();
  const updateShift = useAdminUpdateShift();

  const refreshAllocs = () => queryClient.invalidateQueries({ queryKey: getAdminGetShiftAllocationsQueryKey(shiftId) });

  const handleConfirm = (allocationId: string) => {
    confirmAlloc.mutate({ shiftId, allocationId }, {
      onSuccess: () => { toast({ title: "Allocation confirmed" }); refreshAllocs(); },
      onError: (err) => toast({ title: "Error confirming", description: err.message, variant: "destructive" }),
    });
  };

  const handleDecline = () => {
    if (!declineTarget) return;
    const data: DeclineAllocationInput = { reason: declineReason || "Admin declined" };
    declineAlloc.mutate({ shiftId, allocationId: declineTarget, data }, {
      onSuccess: () => {
        toast({ title: "Allocation declined" });
        setDeclineTarget(null); setDeclineReason("");
        refreshAllocs();
      },
      onError: (err) => toast({ title: "Error declining", description: err.message, variant: "destructive" }),
    });
  };

  const handleMoveToWaitlist = async (allocationId: string) => {
    try {
      await waitlistAllocation(shiftId, allocationId);
      toast({ title: "Driver moved to waitlist" });
      refreshAllocs();
    } catch (err) {
      toast({ title: "Error moving to waitlist", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handlePromoteFromWaitlist = (allocationId: string) => {
    confirmAlloc.mutate({ shiftId, allocationId }, {
      onSuccess: () => { toast({ title: "Driver promoted from waitlist" }); refreshAllocs(); },
      onError: (err) => toast({ title: "Error promoting", description: err.message, variant: "destructive" }),
    });
  };

  const handleAssignVehicle = (allocationId: string, driverProfileId: string, vehicleId: string) => {
    if (!shift) return;
    const data: VehicleAssignmentInput = {
      vehicleId,
      driverProfileId,
      shiftId,
      shiftAllocationId: allocationId,
      assignmentStart: shift.startTime,
      assignmentEnd: shift.endTime,
    };
    assignVehicle.mutate({ data }, {
      onSuccess: () => { toast({ title: "Vehicle assigned" }); refreshAllocs(); },
      onError: (err) => toast({ title: "Error assigning vehicle", description: err.message, variant: "destructive" }),
    });
  };

  const handleCloseShift = () => {
    updateShift.mutate({ shiftId, data: { status: "closed" } }, {
      onSuccess: () => {
        toast({ title: "Shift closed" });
        queryClient.invalidateQueries({ queryKey: getAdminListShiftsQueryKey({}) });
      },
      onError: (err) => toast({ title: "Error closing shift", description: err.message, variant: "destructive" }),
    });
  };

  const grouped = {
    requested: allocations.filter((a) => a.status === "requested"),
    confirmed: allocations.filter((a) => a.status === "confirmed"),
    waitlisted: allocations.filter((a) => a.status === "waitlisted"),
    cancelled: allocations.filter((a) => a.status === "cancelled" || a.status === "declined"),
  };

  const isAtCapacity = shift && (shift.confirmedCount ?? 0) >= (shift.capacity ?? Infinity);

  const renderAllocationRow = (a: AllocationItem, type: string) => (
    <TableRow key={a.id}>
      <TableCell>
        <Link href={`/drivers/${a.driverProfileId}`} className="font-mono text-xs text-[#3DB324] hover:underline">
          {a.driverProfileId.slice(0, 10)}…
        </Link>
      </TableCell>
      <TableCell><Badge variant="outline" className="capitalize">{a.status}</Badge></TableCell>
      <TableCell>
        {a.vehicleAssignmentId
          ? <span className="font-mono text-xs text-gray-500">{a.vehicleAssignmentId.slice(0, 10)}…</span>
          : <span className="text-gray-400 text-sm">Unassigned</span>}
      </TableCell>
      {type === "confirmed" && (
        <TableCell>
          {!a.vehicleAssignmentId ? (
            <Select onValueChange={(v) => handleAssignVehicle(a.id, a.driverProfileId, v)}>
              <SelectTrigger className="w-[180px] h-7 text-xs">
                <SelectValue placeholder="Assign vehicle…" />
              </SelectTrigger>
              <SelectContent>
                {vehicles.length === 0 ? (
                  <SelectItem value="__none" disabled>No active vehicles</SelectItem>
                ) : vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.registrationNumber}{v.make ? ` · ${v.make}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Badge
              variant={a.telematicsSyncStatus === "synced" ? "outline" : "secondary"}
              className={a.telematicsSyncStatus === "synced" ? "text-[#3DB324] border-[#3DB324]" : ""}
            >
              Telematics: {a.telematicsSyncStatus ?? "pending"}
            </Badge>
          )}
        </TableCell>
      )}
      {type === "waitlisted" && (
        <TableCell>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-[#3DB324] text-[#3DB324] hover:bg-[#3DB324] hover:text-white"
            onClick={() => handlePromoteFromWaitlist(a.id)}
            disabled={confirmAlloc.isPending || !!isAtCapacity}
            title={isAtCapacity ? "Shift is at capacity" : "Promote to confirmed"}
          >
            <ArrowUp className="h-3 w-3 mr-1" /> Promote
          </Button>
        </TableCell>
      )}
      {type === "requested" && (
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 border-[#3DB324] text-[#3DB324] hover:bg-[#3DB324] hover:text-white"
              onClick={() => handleConfirm(a.id)}
              disabled={confirmAlloc.isPending}
              data-testid={`btn-confirm-${a.id}`}
              title="Confirm allocation"
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 border-yellow-400 text-yellow-600 hover:bg-yellow-400 hover:text-white"
              onClick={() => handleMoveToWaitlist(a.id)}
              title="Move to waitlist"
              data-testid={`btn-waitlist-${a.id}`}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 border-red-400 text-red-500 hover:bg-red-500 hover:text-white"
              onClick={() => setDeclineTarget(a.id)}
              data-testid={`btn-decline-${a.id}`}
              title="Decline allocation"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  );

  if (!shift) return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-48 w-full" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Decline dialog */}
      <Dialog open={!!declineTarget} onOpenChange={(o) => { if (!o) { setDeclineTarget(null); setDeclineReason(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Decline Allocation</DialogTitle></DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Reason for declining (optional, will be sent to driver)..."
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              className="h-24"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeclineTarget(null); setDeclineReason(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleDecline} disabled={declineAlloc.isPending}>Confirm Decline</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/shifts">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#1C2126] tracking-tight">{shift.title}</h1>
          <p className="text-gray-500 text-sm">
            {format(new Date(shift.startTime), "EEEE, MMM d yyyy")} · {format(new Date(shift.startTime), "HH:mm")} – {format(new Date(shift.endTime), "HH:mm")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="capitalize">{shift.fleetType}</Badge>
          <Badge variant={shift.status === "open" ? "default" : "secondary"} className="capitalize">{shift.status}</Badge>
          {(shift.status === "open" || shift.status === "full") && (
            <Button size="sm" variant="outline" onClick={handleCloseShift} disabled={updateShift.isPending}>
              <Lock className="h-4 w-4 mr-1" /> Close Shift
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Capacity", value: shift.capacity ?? "—", color: "" },
          { label: "Confirmed", value: shift.confirmedCount ?? 0, color: isAtCapacity ? "text-orange-600" : "text-[#3DB324]" },
          { label: "Pending Requests", value: grouped.requested.length, color: grouped.requested.length > 0 ? "text-blue-600" : "" },
          { label: "Waitlisted", value: grouped.waitlisted.length, color: grouped.waitlisted.length > 0 ? "text-yellow-600" : "" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {isAtCapacity && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          ⚠️ Shift is at full capacity. Confirming more requests or promoting from waitlist requires increasing the capacity first.
        </div>
      )}

      {/* Allocations Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="requested">Requests ({grouped.requested.length})</TabsTrigger>
          <TabsTrigger value="confirmed">Confirmed ({grouped.confirmed.length})</TabsTrigger>
          <TabsTrigger value="waitlisted">Waitlist ({grouped.waitlisted.length})</TabsTrigger>
          <TabsTrigger value="cancelled">Declined ({grouped.cancelled.length})</TabsTrigger>
        </TabsList>

        <div className="mt-4 border rounded-xl bg-white shadow-sm overflow-hidden">
          {(["requested", "confirmed", "waitlisted", "cancelled"] as const).map((tab) => (
            <TabsContent key={tab} value={tab} className="m-0">
              {loadingAllocs ? (
                <div className="p-6"><Skeleton className="h-20 w-full" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Driver ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Vehicle</TableHead>
                      {tab === "confirmed" && <TableHead>Assign Vehicle</TableHead>}
                      {tab === "waitlisted" && <TableHead>Promote</TableHead>}
                      {tab === "requested" && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grouped[tab].length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                          No {tab} allocations.
                        </TableCell>
                      </TableRow>
                    ) : (
                      grouped[tab].map((a) => renderAllocationRow(a, tab))
                    )}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}
