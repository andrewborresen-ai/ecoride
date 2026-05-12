import { useState } from "react";
import {
  useAdminListVehicles,
  useAdminCreateVehicle,
  useAdminUpdateVehicle,
  getAdminListVehiclesQueryKey,
} from "@workspace/api-client-react";
import type { VehicleInput, VehicleUpdate } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

interface VehicleItem {
  id: string;
  registrationNumber: string;
  make?: string;
  model?: string;
  year?: string;
  colour?: string;
  vin?: string;
  fleetType?: string;
  status?: string;
  telematicsVehicleId?: string;
  telematicsEnabled?: boolean | string;
  notes?: string;
}

interface VehiclesData {
  items: VehicleItem[];
}

const EMPTY_VEHICLE: VehicleInput = {
  registrationNumber: "",
  make: "",
  model: "",
  year: "",
  colour: "",
  vin: "",
  fleetType: "electric",
  telematicsVehicleId: "",
  telematicsEnabled: "false",
  notes: "",
};

function VehicleFormDialog({
  mode,
  vehicle,
  onSave,
  isPending,
  trigger,
}: {
  mode: "create" | "edit";
  vehicle: Partial<VehicleInput> & { id?: string };
  onSave: (data: VehicleInput | VehicleUpdate) => void;
  isPending: boolean;
  trigger: React.ReactNode;
}) {
  const [form, setForm] = useState<VehicleInput>({
    registrationNumber: vehicle.registrationNumber ?? "",
    make: vehicle.make ?? "",
    model: vehicle.model ?? "",
    year: vehicle.year ?? "",
    colour: vehicle.colour ?? "",
    vin: vehicle.vin ?? "",
    fleetType: vehicle.fleetType ?? "electric",
    telematicsVehicleId: vehicle.telematicsVehicleId ?? "",
    telematicsEnabled: vehicle.telematicsEnabled?.toString() ?? "false",
    notes: vehicle.notes ?? "",
  });
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild onClick={() => {
        setForm({
          registrationNumber: vehicle.registrationNumber ?? "",
          make: vehicle.make ?? "",
          model: vehicle.model ?? "",
          year: vehicle.year ?? "",
          colour: vehicle.colour ?? "",
          vin: vehicle.vin ?? "",
          fleetType: vehicle.fleetType ?? "electric",
          telematicsVehicleId: vehicle.telematicsVehicleId ?? "",
          telematicsEnabled: vehicle.telematicsEnabled?.toString() ?? "false",
          notes: vehicle.notes ?? "",
        });
      }}>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add New Vehicle" : "Edit Vehicle"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="col-span-2 space-y-1.5">
            <Label>Registration Number *</Label>
            <Input
              value={form.registrationNumber}
              onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
              placeholder="e.g. CA 123-456"
              data-testid="input-vehicle-reg"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Make</Label>
            <Input value={form.make ?? ""} onChange={(e) => setForm({ ...form, make: e.target.value })} placeholder="e.g. Toyota" />
          </div>
          <div className="space-y-1.5">
            <Label>Model</Label>
            <Input value={form.model ?? ""} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="e.g. Corolla" />
          </div>
          <div className="space-y-1.5">
            <Label>Year</Label>
            <Input value={form.year ?? ""} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="e.g. 2022" />
          </div>
          <div className="space-y-1.5">
            <Label>Colour</Label>
            <Input value={form.colour ?? ""} onChange={(e) => setForm({ ...form, colour: e.target.value })} placeholder="e.g. White" />
          </div>
          <div className="space-y-1.5">
            <Label>VIN</Label>
            <Input value={form.vin ?? ""} onChange={(e) => setForm({ ...form, vin: e.target.value })} className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label>Fleet Type</Label>
            <Select value={form.fleetType ?? "electric"} onValueChange={(v) => setForm({ ...form, fleetType: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="electric">Electric (EcoRide)</SelectItem>
                <SelectItem value="lpg">LPG (Khula Rides)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 border-t pt-4 space-y-1.5">
            <Label className="text-[#3DB324] font-semibold">Telematics Configuration</Label>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Telematics Vehicle ID</Label>
            <Input
              value={form.telematicsVehicleId ?? ""}
              onChange={(e) => setForm({ ...form, telematicsVehicleId: e.target.value })}
              placeholder="Provider's vehicle ID"
              className="font-mono"
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Telematics Enabled</Label>
            <Select value={form.telematicsEnabled?.toString() ?? "false"} onValueChange={(v) => setForm({ ...form, telematicsEnabled: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Enabled</SelectItem>
                <SelectItem value="false">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Notes</Label>
            <Input value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Internal notes..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={() => { onSave(form); setOpen(false); }}
            disabled={isPending || !form.registrationNumber}
            className="bg-[#3DB324] hover:bg-[#329b1d]"
            data-testid="btn-save-vehicle"
          >
            {mode === "create" ? "Add Vehicle" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function VehiclesPage() {
  const [fleetType, setFleetType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: vehiclesRes, isLoading } = useAdminListVehicles({
    fleetType: fleetType !== "all" ? fleetType : undefined,
    status: status !== "all" ? status : undefined,
  });
  const vehicles = (vehiclesRes?.data as VehiclesData | undefined)?.items ?? [];

  const createVehicle = useAdminCreateVehicle();
  const updateVehicle = useAdminUpdateVehicle();

  const handleCreate = (data: VehicleInput | VehicleUpdate) => {
    createVehicle.mutate({ data: data as VehicleInput }, {
      onSuccess: () => {
        toast({ title: "Vehicle added to fleet" });
        queryClient.invalidateQueries({ queryKey: getAdminListVehiclesQueryKey({}) });
      },
      onError: (err) => toast({ title: "Error adding vehicle", description: err.message, variant: "destructive" }),
    });
  };

  const handleUpdate = (vehicleId: string, data: VehicleInput | VehicleUpdate) => {
    updateVehicle.mutate({ vehicleId, data: data as VehicleUpdate }, {
      onSuccess: () => {
        toast({ title: "Vehicle updated" });
        queryClient.invalidateQueries({ queryKey: getAdminListVehiclesQueryKey({}) });
      },
      onError: (err) => toast({ title: "Error updating vehicle", description: err.message, variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1C2126] tracking-tight">Vehicles</h1>
          <p className="text-gray-500">Manage fleet vehicles and telematics configuration.</p>
        </div>
        <VehicleFormDialog
          mode="create"
          vehicle={EMPTY_VEHICLE}
          onSave={handleCreate}
          isPending={createVehicle.isPending}
          trigger={
            <Button className="bg-[#3DB324] hover:bg-[#329b1d]" data-testid="btn-add-vehicle">
              <Plus className="mr-2 h-4 w-4" /> Add Vehicle
            </Button>
          }
        />
      </div>

      <div className="flex gap-4">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
            <SelectItem value="retired">Retired</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fleetType} onValueChange={setFleetType}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Fleet Type" /></SelectTrigger>
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
                <TableHead>Year</TableHead>
                <TableHead>Fleet Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Telematics ID</TableHead>
                <TableHead>Telematics</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    {Array(8).fill(0).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>)}
                  </TableRow>
                ))
              ) : vehicles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">No vehicles found.</TableCell>
                </TableRow>
              ) : (
                vehicles.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium font-mono">{v.registrationNumber}</TableCell>
                    <TableCell>{[v.make, v.model].filter(Boolean).join(" ") || "—"}</TableCell>
                    <TableCell>{v.year ?? "—"}</TableCell>
                    <TableCell className="capitalize">{v.fleetType ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={v.status === "active" ? "default" : "secondary"}>{v.status ?? "—"}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-gray-500">{v.telematicsVehicleId || "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={v.telematicsEnabled && v.telematicsEnabled !== "false" ? "outline" : "secondary"}
                        className={v.telematicsEnabled && v.telematicsEnabled !== "false" ? "border-[#3DB324] text-[#3DB324]" : ""}
                      >
                        {v.telematicsEnabled && v.telematicsEnabled !== "false" ? "Enabled" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <VehicleFormDialog
                        mode="edit"
                        vehicle={{ ...v, telematicsEnabled: v.telematicsEnabled?.toString() }}
                        onSave={(data) => handleUpdate(v.id, data)}
                        isPending={updateVehicle.isPending}
                        trigger={
                          <Button variant="ghost" size="icon" data-testid={`btn-edit-vehicle-${v.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        }
                      />
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
