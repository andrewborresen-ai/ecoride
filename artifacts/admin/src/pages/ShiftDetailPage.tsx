import { useState } from "react";
import { useRoute } from "wouter";
import {
  useAdminListShifts,
  useAdminGetShiftAllocations,
  useAdminConfirmAllocation,
  useAdminDeclineAllocation,
  useAdminListVehicles,
  useAdminCreateVehicleAssignment,
  getAdminGetShiftAllocationsQueryKey,
} from "@workspace/api-client-react";
import type { DeclineAllocationInput, VehicleAssignmentInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Check, X } from "lucide-react";
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

  const { data: shiftsRes } = useAdminListShifts({});
  const allShifts = (shiftsRes?.data as ListData<ShiftItem> | undefined)?.items ?? [];
  const shift = allShifts.find((s) => s.id === shiftId);

  const { data: allocsRes, isLoading: loadingAllocs } = useAdminGetShiftAllocations(shiftId);
  const allocations = (allocsRes?.data as ListData<AllocationItem> | undefined)?.items ?? [];

  const { data: vehiclesRes } = useAdminListVehicles({ status: "active" });
  const vehicles = (vehiclesRes?.data as ListData<VehicleItem> | undefined)?.items ?? [];

  const confirmAlloc = useAdminConfirmAllocation();
  const declineAlloc = useAdminDeclineAllocation();
  const assignVehicle = useAdminCreateVehicleAssignment();

  const handleConfirm = (allocationId: string) => {
    confirmAlloc.mutate({ shiftId, allocationId }, {
      onSuccess: () => {
        toast({ title: "Allocation confirmed" });
        queryClient.invalidateQueries({ queryKey: getAdminGetShiftAllocationsQueryKey(shiftId) });
      },
      onError: (err) => {
        toast({ title: "Error confirming allocation", description: err.message, variant: "destructive" });
      },
    });
  };

  const handleDecline = (allocationId: string) => {
    const data: DeclineAllocationInput = { reason: "Admin declined" };
    declineAlloc.mutate({ shiftId, allocationId, data }, {
      onSuccess: () => {
        toast({ title: "Allocation declined" });
        queryClient.invalidateQueries({ queryKey: getAdminGetShiftAllocationsQueryKey(shiftId) });
      },
      onError: (err) => {
        toast({ title: "Error declining allocation", description: err.message, variant: "destructive" });
      },
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
      onSuccess: () => {
        toast({ title: "Vehicle assigned successfully" });
        queryClient.invalidateQueries({ queryKey: getAdminGetShiftAllocationsQueryKey(shiftId) });
      },
      onError: (err) => {
        toast({ title: "Error assigning vehicle", description: err.message, variant: "destructive" });
      },
    });
  };

  const grouped = {
    requested: allocations.filter((a) => a.status === 'requested'),
    confirmed: allocations.filter((a) => a.status === 'confirmed'),
    waitlisted: allocations.filter((a) => a.status === 'waitlisted'),
    cancelled: allocations.filter((a) => a.status === 'cancelled' || a.status === 'declined'),
  };

  if (!shift) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const renderTable = (items: AllocationItem[], type: string) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Driver</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Vehicle</TableHead>
          {type === 'confirmed' && <TableHead>Assign Vehicle</TableHead>}
          {type === 'requested' && <TableHead className="text-right">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-center py-8 text-gray-500">
              No {type} allocations.
            </TableCell>
          </TableRow>
        ) : (
          items.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="font-medium">
                <Link href={`/drivers/${a.driverProfileId}`} className="text-[#3DB324] hover:underline font-mono text-sm">
                  {a.driverProfileId.slice(0, 8)}…
                </Link>
              </TableCell>
              <TableCell><Badge variant="outline">{a.status}</Badge></TableCell>
              <TableCell>
                {a.vehicleAssignmentId ? (
                  <Badge variant="secondary" className="font-mono text-xs">{a.vehicleAssignmentId.slice(0, 8)}…</Badge>
                ) : (
                  <span className="text-gray-400 text-sm">Unassigned</span>
                )}
              </TableCell>
              {type === 'confirmed' && (
                <TableCell>
                  {!a.vehicleAssignmentId ? (
                    <Select onValueChange={(v) => handleAssignVehicle(a.id, a.driverProfileId, v)}>
                      <SelectTrigger className="w-[180px] h-8 text-xs">
                        <SelectValue placeholder="Select Vehicle" />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicles.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.registrationNumber}{v.make ? ` (${v.make})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge
                      variant={a.telematicsSyncStatus === 'synced' ? 'outline' : 'secondary'}
                      className={a.telematicsSyncStatus === 'synced' ? 'text-[#3DB324] border-[#3DB324]' : ''}
                    >
                      Telematics: {a.telematicsSyncStatus ?? 'pending'}
                    </Badge>
                  )}
                </TableCell>
              )}
              {type === 'requested' && (
                <TableCell className="text-right space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-[#3DB324] border-[#3DB324] hover:bg-[#3DB324] hover:text-white"
                    onClick={() => handleConfirm(a.id)}
                    disabled={confirmAlloc.isPending}
                    data-testid={`btn-confirm-${a.id}`}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-500 border-red-500 hover:bg-red-500 hover:text-white"
                    onClick={() => handleDecline(a.id)}
                    disabled={declineAlloc.isPending}
                    data-testid={`btn-decline-${a.id}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/shifts">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#1C2126] tracking-tight">{shift.title}</h1>
          <p className="text-gray-500">
            {format(new Date(shift.startTime), "MMM d, yyyy HH:mm")} – {format(new Date(shift.endTime), "HH:mm")}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge className="text-sm px-3 py-1 capitalize">{shift.fleetType}</Badge>
          <Badge variant="outline" className="text-sm px-3 py-1">{shift.status}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Capacity</p>
            <p className="text-2xl font-bold">{shift.capacity ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Confirmed</p>
            <p className="text-2xl font-bold text-[#3DB324]">{shift.confirmedCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Pending Requests</p>
            <p className="text-2xl font-bold text-orange-500">{grouped.requested.length}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="requested">Requested ({grouped.requested.length})</TabsTrigger>
          <TabsTrigger value="confirmed">Confirmed ({grouped.confirmed.length})</TabsTrigger>
          <TabsTrigger value="waitlisted">Waitlisted ({grouped.waitlisted.length})</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled ({grouped.cancelled.length})</TabsTrigger>
        </TabsList>
        <div className="mt-4 border rounded-xl bg-white overflow-hidden shadow-sm">
          <TabsContent value="requested" className="m-0">
            {loadingAllocs ? <div className="p-8"><Skeleton className="h-32" /></div> : renderTable(grouped.requested, 'requested')}
          </TabsContent>
          <TabsContent value="confirmed" className="m-0">
            {loadingAllocs ? <div className="p-8"><Skeleton className="h-32" /></div> : renderTable(grouped.confirmed, 'confirmed')}
          </TabsContent>
          <TabsContent value="waitlisted" className="m-0">
            {loadingAllocs ? <div className="p-8"><Skeleton className="h-32" /></div> : renderTable(grouped.waitlisted, 'waitlisted')}
          </TabsContent>
          <TabsContent value="cancelled" className="m-0">
            {loadingAllocs ? <div className="p-8"><Skeleton className="h-32" /></div> : renderTable(grouped.cancelled, 'cancelled')}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
