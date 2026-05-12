import { useState } from "react";
import {
  useAdminListVehicles,
  useAdminCreateVehicle,
  getAdminListVehiclesQueryKey,
} from "@workspace/api-client-react";
import type { VehicleInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VehicleItem {
  id: string;
  registrationNumber: string;
  make?: string;
  model?: string;
  fleetType?: string;
  status?: string;
  telematicsEnabled?: boolean | string;
}

interface VehiclesData {
  items: VehicleItem[];
}

const EMPTY_VEHICLE: VehicleInput = {
  registrationNumber: "",
  make: "",
  model: "",
  fleetType: "electric",
};

export default function VehiclesPage() {
  const [fleetType, setFleetType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: vehiclesRes, isLoading } = useAdminListVehicles({
    fleetType: fleetType !== "all" ? fleetType : undefined,
    status: status !== "all" ? status : undefined,
  });

  const vehicles = (vehiclesRes?.data as VehiclesData | undefined)?.items ?? [];

  const createVehicle = useAdminCreateVehicle();
  const [newVehicle, setNewVehicle] = useState<VehicleInput>(EMPTY_VEHICLE);

  const handleCreate = () => {
    if (!newVehicle.registrationNumber) { toast({ title: "Registration required", variant: "destructive" }); return; }

    createVehicle.mutate({ data: newVehicle }, {
      onSuccess: () => {
        toast({ title: "Vehicle created" });
        setCreateOpen(false);
        setNewVehicle(EMPTY_VEHICLE);
        queryClient.invalidateQueries({ queryKey: getAdminListVehiclesQueryKey({}) });
      },
      onError: (err) => {
        toast({ title: "Error creating vehicle", description: err.message, variant: "destructive" });
      },
    });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1C2126] tracking-tight">Vehicles</h1>
          <p className="text-gray-500">Manage fleet vehicles and telematics status.</p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#3DB324] hover:bg-[#329b1d]" data-testid="btn-add-vehicle">
              <Plus className="mr-2 h-4 w-4" /> Add Vehicle
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Vehicle</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Registration Number</label>
                <Input
                  value={newVehicle.registrationNumber}
                  onChange={(e) => setNewVehicle({ ...newVehicle, registrationNumber: e.target.value })}
                  data-testid="input-vehicle-reg"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Make</label>
                  <Input value={newVehicle.make ?? ""} onChange={(e) => setNewVehicle({ ...newVehicle, make: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Model</label>
                  <Input value={newVehicle.model ?? ""} onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Fleet Type</label>
                <Select value={newVehicle.fleetType ?? "electric"} onValueChange={(v) => setNewVehicle({ ...newVehicle, fleetType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="electric">Electric (EcoRide)</SelectItem>
                    <SelectItem value="lpg">LPG (Khula Rides)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createVehicle.isPending} className="bg-[#3DB324] hover:bg-[#329b1d]" data-testid="btn-save-vehicle">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
            <SelectItem value="retired">Retired</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fleetType} onValueChange={setFleetType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Fleet Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Fleet Types</SelectItem>
            <SelectItem value="electric">Electric</SelectItem>
            <SelectItem value="lpg">LPG</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Registration</TableHead>
                <TableHead>Make / Model</TableHead>
                <TableHead>Fleet Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Telematics</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  </TableRow>
                ))
              ) : vehicles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">No vehicles found.</TableCell>
                </TableRow>
              ) : (
                vehicles.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.registrationNumber}</TableCell>
                    <TableCell>{[v.make, v.model].filter(Boolean).join(' ') || '—'}</TableCell>
                    <TableCell className="capitalize">{v.fleetType ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={v.status === 'active' ? 'default' : 'secondary'}>{v.status ?? '—'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={v.telematicsEnabled ? 'outline' : 'secondary'}
                        className={v.telematicsEnabled ? 'border-[#3DB324] text-[#3DB324]' : ''}
                      >
                        {v.telematicsEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
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
