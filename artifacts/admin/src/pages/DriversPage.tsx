import { useState } from "react";
import { useAdminListDrivers } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

interface DriverItem {
  id: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  fleetType?: string;
  status: string;
  telematicsSyncStatus?: string;
  createdAt?: string;
}

interface DriversData {
  items: DriverItem[];
}

export default function DriversPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [fleetType, setFleetType] = useState<string>("all");

  const { data, isLoading } = useAdminListDrivers({
    search: search || undefined,
    status: status !== "all" ? status : undefined,
  });

  const items = (data?.data as DriversData | undefined)?.items ?? [];
  const filteredItems = fleetType === "all" ? items : items.filter((d) => d.fleetType === fleetType);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1C2126] tracking-tight">Drivers</h1>
        <p className="text-gray-500">Manage driver profiles and applications.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <Input
          placeholder="Search by name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
          data-testid="input-search-drivers"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]" data-testid="select-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fleetType} onValueChange={setFleetType}>
          <SelectTrigger className="w-[180px]" data-testid="select-fleet-type">
            <SelectValue placeholder="Fleet Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Fleet Types</SelectItem>
            <SelectItem value="electric">Electric (EcoRide)</SelectItem>
            <SelectItem value="lpg">LPG (Khula Rides)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Fleet Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Telematics Sync</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    No drivers found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((driver) => (
                  <TableRow key={driver.id} className="cursor-pointer hover:bg-gray-50" data-testid={`row-driver-${driver.id}`}>
                    <TableCell className="font-medium">
                      <Link href={`/drivers/${driver.id}`} className="text-[#3DB324] hover:underline">
                        {driver.firstName} {driver.lastName}
                      </Link>
                    </TableCell>
                    <TableCell>{driver.phone ?? '—'}</TableCell>
                    <TableCell className="capitalize">{driver.fleetType ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={
                        driver.status === 'approved' ? 'default' :
                        driver.status === 'rejected' || driver.status === 'suspended' ? 'destructive' :
                        'secondary'
                      }>
                        {driver.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          driver.telematicsSyncStatus === 'synced' ? 'outline' :
                          driver.telematicsSyncStatus === 'failed' ? 'destructive' :
                          'secondary'
                        }
                        className={driver.telematicsSyncStatus === 'synced' ? 'border-[#3DB324] text-[#3DB324]' : ''}
                      >
                        {driver.telematicsSyncStatus ?? 'pending'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {driver.createdAt ? format(new Date(driver.createdAt), "MMM d, yyyy") : '—'}
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
