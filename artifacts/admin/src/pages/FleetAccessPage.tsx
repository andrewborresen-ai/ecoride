import { useState } from "react";
import { useAdminListVehicleAccessEvents } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { X } from "lucide-react";

interface AccessEvent {
  id: string;
  createdAt: string;
  driverProfileId: string;
  vehicleId: string;
  eventType: string;
  biometricResult?: string;
  status: string;
  telematicsRequestId?: string;
  telematicsVehicleId?: string;
}


export default function FleetAccessPage() {
  const [vehicleId, setVehicleId] = useState("");
  const [driverProfileId, setDriverProfileId] = useState("");
  const [eventType, setEventType] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const { data: eventsRes, isLoading } = useAdminListVehicleAccessEvents({
    vehicleId: vehicleId || undefined,
    driverProfileId: driverProfileId || undefined,
    from: fromDate ? new Date(fromDate).toISOString() : undefined,
    to: toDate ? new Date(toDate + "T23:59:59").toISOString() : undefined,
  });
  const allEvents = (eventsRes?.data as AccessEvent[] | undefined) ?? [];
  const events = eventType === "all" ? allEvents : allEvents.filter((e) => e.eventType === eventType);

  const clearFilters = () => {
    setVehicleId(""); setDriverProfileId("");
    setEventType("all"); setFromDate(""); setToDate("");
  };

  const hasFilters = vehicleId || driverProfileId || eventType !== "all" || fromDate || toDate;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[#1C2126] tracking-tight">Fleet Access Log</h1>
        <p className="text-gray-500">Audit trail of vehicle unlock, ignition, and biometric events.</p>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Vehicle ID</Label>
            <Input placeholder="Vehicle UUID" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="h-9 text-sm font-mono" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Driver Profile ID</Label>
            <Input placeholder="Driver UUID" value={driverProfileId} onChange={(e) => setDriverProfileId(e.target.value)} className="h-9 text-sm font-mono" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Event Type</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="unlock">Unlock</SelectItem>
                <SelectItem value="lock">Lock</SelectItem>
                <SelectItem value="ignition_on">Ignition On</SelectItem>
                <SelectItem value="ignition_off">Ignition Off</SelectItem>
                <SelectItem value="biometric_check">Biometric Check</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">From Date</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To Date</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9 text-sm" />
          </div>
        </div>
        {hasFilters && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-gray-500">{events.length} result{events.length !== 1 ? "s" : ""}</span>
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs text-gray-500 gap-1">
              <X className="h-3 w-3" /> Clear filters
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Driver ID</TableHead>
                <TableHead>Vehicle ID</TableHead>
                <TableHead>Event Type</TableHead>
                <TableHead>Biometric</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Telematics Ref</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(8).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    {Array(7).fill(0).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>)}
                  </TableRow>
                ))
              ) : events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    No access events found for the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                events.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm tabular-nums">
                      {format(new Date(e.createdAt), "MMM d, yyyy HH:mm:ss")}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-gray-600">{e.driverProfileId.slice(0, 8)}…</TableCell>
                    <TableCell className="font-mono text-xs text-gray-600">{e.vehicleId.slice(0, 8)}…</TableCell>
                    <TableCell>
                      <span className="capitalize text-sm">{e.eventType.replace(/_/g, " ")}</span>
                    </TableCell>
                    <TableCell>
                      {e.biometricResult ? (
                        <Badge variant={e.biometricResult === "pass" ? "default" : "destructive"} className={e.biometricResult === "pass" ? "bg-[#3DB324] hover:bg-[#3DB324]" : ""}>
                          {e.biometricResult}
                        </Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={e.status === "success" ? "default" : e.status === "failed" ? "destructive" : "secondary"}
                        className={e.status === "success" ? "bg-[#3DB324] hover:bg-[#3DB324]" : ""}
                      >
                        {e.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-gray-400">
                      {e.telematicsRequestId ? e.telematicsRequestId.slice(0, 12) + "…" : "—"}
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
