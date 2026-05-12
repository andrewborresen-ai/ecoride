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
  agreementSigned?: boolean;
  documentsStatus?: string;
  createdAt?: string;
}


const STATUS_BADGE: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  submitted: "bg-blue-100 text-blue-800",
  pending: "bg-gray-100 text-gray-700",
  rejected: "bg-red-100 text-red-800",
  suspended: "bg-orange-100 text-orange-800",
};

export default function DriversPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [fleetType, setFleetType] = useState<string>("all");
  const [agreementFilter, setAgreementFilter] = useState<string>("all");
  const [telematicsFilter, setTelematicsFilter] = useState<string>("all");
  const [docStatusFilter, setDocStatusFilter] = useState<string>("all");
  const [userStatusFilter, setUserStatusFilter] = useState<string>("all");

  const { data, isLoading } = useAdminListDrivers({
    search: search || undefined,
    status: status !== "all" ? status : undefined,
    limit: 500,
    ...(userStatusFilter !== "all" ? { userStatus: userStatusFilter } : {}),
  } as Parameters<typeof useAdminListDrivers>[0]);

  const raw = (data?.data as DriverItem[] | undefined) ?? [];

  const items = raw
    .filter((d) => fleetType === "all" || d.fleetType === fleetType)
    .filter((d) => agreementFilter === "all" || (agreementFilter === "signed" ? d.agreementSigned : !d.agreementSigned))
    .filter((d) => telematicsFilter === "all" || d.telematicsSyncStatus === telematicsFilter)
    .filter((d) => docStatusFilter === "all" || d.documentsStatus === docStatusFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1C2126] tracking-tight">Drivers</h1>
          <p className="text-gray-500">Manage driver profiles and applications.</p>
        </div>
        <div className="text-sm text-gray-500">{items.length} result{items.length !== 1 ? "s" : ""}</div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search name, phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
          data-testid="input-search-drivers"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[170px]" data-testid="select-status">
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
          <SelectTrigger className="w-[170px]" data-testid="select-fleet-type">
            <SelectValue placeholder="Fleet Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Fleet Types</SelectItem>
            <SelectItem value="electric">Electric (EcoRide)</SelectItem>
            <SelectItem value="lpg">LPG (Khula Rides)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={agreementFilter} onValueChange={setAgreementFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Agreement" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Agreement: All</SelectItem>
            <SelectItem value="signed">Signed</SelectItem>
            <SelectItem value="unsigned">Not Signed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={telematicsFilter} onValueChange={setTelematicsFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Telematics" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Telematics: All</SelectItem>
            <SelectItem value="synced">Synced</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="not_started">Not Started</SelectItem>
          </SelectContent>
        </Select>
        <Select value={docStatusFilter} onValueChange={setDocStatusFilter}>
          <SelectTrigger className="w-[185px]">
            <SelectValue placeholder="Documents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Documents: All</SelectItem>
            <SelectItem value="complete">Complete</SelectItem>
            <SelectItem value="incomplete">Incomplete</SelectItem>
            <SelectItem value="pending_review">Pending Review</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={userStatusFilter} onValueChange={setUserStatusFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="User Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">User Status: All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
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
                <TableHead>Agreement</TableHead>
                <TableHead>Telematics</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    {Array(7).fill(0).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    No drivers found matching the filters.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((driver) => (
                  <TableRow key={driver.id} data-testid={`row-driver-${driver.id}`}>
                    <TableCell className="font-medium">
                      <Link href={`/drivers/${driver.id}`} className="text-[#3DB324] hover:underline">
                        {driver.firstName} {driver.lastName}
                      </Link>
                    </TableCell>
                    <TableCell>{driver.phone ?? "—"}</TableCell>
                    <TableCell className="capitalize">{driver.fleetType ?? "—"}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[driver.status] ?? "bg-gray-100 text-gray-700"}`}>
                        {driver.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={driver.agreementSigned ? "outline" : "secondary"}
                        className={driver.agreementSigned ? "border-[#3DB324] text-[#3DB324]" : ""}
                      >
                        {driver.agreementSigned ? "Signed" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          driver.telematicsSyncStatus === "synced" ? "outline" :
                          driver.telematicsSyncStatus === "failed" ? "destructive" : "secondary"
                        }
                        className={driver.telematicsSyncStatus === "synced" ? "border-[#3DB324] text-[#3DB324]" : ""}
                      >
                        {driver.telematicsSyncStatus ?? "pending"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {driver.createdAt ? format(new Date(driver.createdAt), "MMM d, yyyy") : "—"}
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
