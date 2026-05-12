import { useState } from "react";
import { useAdminListVehicleAccessEvents } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

export default function FleetAccessPage() {
  const [vehicleId, setVehicleId] = useState("");
  const [driverProfileId, setDriverProfileId] = useState("");

  const { data: eventsRes, isLoading } = useAdminListVehicleAccessEvents({
    vehicleId: vehicleId || undefined,
    driverProfileId: driverProfileId || undefined
  });
  
  const events = (eventsRes as any)?.data?.items || [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[#1C2126] tracking-tight">Fleet Access Log</h1>
        <p className="text-gray-500">Audit trail of vehicle unlock and ignition events.</p>
      </div>

      <div className="flex gap-4">
        <Input 
          placeholder="Filter by Vehicle ID..." 
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
          className="max-w-xs"
        />
        <Input 
          placeholder="Filter by Driver Profile ID..." 
          value={driverProfileId}
          onChange={(e) => setDriverProfileId(e.target.value)}
          className="max-w-xs"
        />
      </div>

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
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(8).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  </TableRow>
                ))
              ) : events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">No access events found.</TableCell>
                </TableRow>
              ) : (
                events.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm text-gray-600">
                      {format(new Date(e.createdAt), "MMM d, yyyy HH:mm:ss")}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{e.driverProfileId.slice(0, 8)}...</TableCell>
                    <TableCell className="font-mono text-xs">{e.vehicleId.slice(0, 8)}...</TableCell>
                    <TableCell className="capitalize">{e.eventType}</TableCell>
                    <TableCell>
                      {e.biometricResult ? (
                        <Badge variant={e.biometricResult === 'pass' ? 'default' : 'destructive'} className="text-[10px] uppercase tracking-wider">
                          {e.biometricResult}
                        </Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={e.status === 'success' ? 'default' : e.status === 'failed' ? 'destructive' : 'secondary'} className={e.status === 'success' ? 'bg-[#3DB324] hover:bg-[#3DB324]' : ''}>
                        {e.status}
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
