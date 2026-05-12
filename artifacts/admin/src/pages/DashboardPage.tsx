import {
  useGetAdminDashboardSummary,
  useAdminListDrivers,
  useAdminListShifts,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { Users, Car, CalendarDays, DollarSign, Clock, AlertCircle, CheckCircle } from "lucide-react";
import { Link } from "wouter";

interface DashboardSummary {
  totalDrivers?: number;
  approvedDrivers?: number;
  activeVehicles?: number;
  openShifts?: number;
  pendingApplications?: number;
  shiftsRequiringAllocation?: number;
  earningsPendingPublish?: number;
  totalEarningsThisWeekCents?: number;
}

interface DriverItem {
  id: string;
  firstName?: string;
  lastName?: string;
  status: string;
  fleetType?: string;
  createdAt?: string;
}

interface ShiftItem {
  id: string;
  title?: string;
  fleetType?: string;
  startTime: string;
  endTime: string;
  capacity?: number;
  confirmedCount?: number;
  status?: string;
}

interface ListData<T> {
  items: T[];
}

const now = new Date();
const weekStart = startOfWeek(now).toISOString();
const weekEnd = endOfWeek(now).toISOString();

const KPI_SKELETON = () => <Skeleton className="h-32 w-full rounded-xl" />;

export default function DashboardPage() {
  const { data: summaryRes, isLoading: loadingSummary } = useGetAdminDashboardSummary();
  const summary = summaryRes?.data as DashboardSummary | undefined;

  const { data: recentDriversRes, isLoading: loadingDrivers } = useAdminListDrivers({ limit: 6 });
  const recentDrivers = (recentDriversRes?.data as DriverItem[] | undefined) ?? [];

  const { data: pendingDriversRes } = useAdminListDrivers({ status: "submitted", limit: 100 });
  const pendingCount = (pendingDriversRes?.data as DriverItem[] | undefined)?.length ?? 0;

  const { data: approvedDriversRes } = useAdminListDrivers({ status: "approved", limit: 1000 });
  const approvedTotal = (approvedDriversRes?.data as DriverItem[] | undefined)?.length ?? 0;

  const { data: allDriversRes } = useAdminListDrivers({ limit: 1000 });
  const totalDriversCount = (allDriversRes?.data as DriverItem[] | undefined)?.length ?? (summary?.totalDrivers ?? 0);

  const { data: openShiftsRes, isLoading: loadingShifts } = useAdminListShifts({
    status: "open",
    from: weekStart,
    to: weekEnd,
  });
  const openShiftsThisWeek = (openShiftsRes?.data as ShiftItem[] | undefined) ?? [];

  const { data: allShiftsRes } = useAdminListShifts({ status: "open" });
  const openShiftsAll = (allShiftsRes?.data as ShiftItem[] | undefined) ?? [];
  const shiftsNeedingAlloc = openShiftsAll.filter(
    (s) => (s.confirmedCount ?? 0) < (s.capacity ?? 0) && (s.capacity ?? 0) > 0
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1C2126] tracking-tight">Operations Dashboard</h1>
        <p className="text-gray-500">
          EcoRide Fleet Platform — {format(now, "EEEE, MMMM d yyyy")}
        </p>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {loadingSummary ? (
          Array(4).fill(0).map((_, i) => <KPI_SKELETON key={i} />)
        ) : (
          <>
            <Card className="border-l-4 border-l-gray-400">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Total Drivers</CardTitle>
                <Users className="h-4 w-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-[#1C2126]">{totalDriversCount}</div>
                <p className="text-xs text-gray-400 mt-1">All registrations</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-[#3DB324]">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Approved Drivers</CardTitle>
                <CheckCircle className="h-4 w-4 text-[#3DB324]" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-[#1C2126]">{summary?.approvedDrivers ?? approvedTotal}</div>
                <p className="text-xs text-gray-400 mt-1">Active in the fleet</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-400">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Pending Applications</CardTitle>
                <Users className="h-4 w-4 text-orange-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">{summary?.pendingApplications ?? pendingCount}</div>
                <p className="text-xs text-gray-400 mt-1">Awaiting review</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-400">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Active Vehicles</CardTitle>
                <Car className="h-4 w-4 text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-[#1C2126]">{summary?.activeVehicles ?? 0}</div>
                <p className="text-xs text-gray-400 mt-1">In the fleet</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-400">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Open Shifts This Week</CardTitle>
                <CalendarDays className="h-4 w-4 text-purple-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-[#1C2126]">{openShiftsThisWeek.length}</div>
                <p className="text-xs text-gray-400 mt-1">{format(now, "'Week of' MMM d")}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Action Required Banner */}
      {((summary?.shiftsRequiringAllocation ?? shiftsNeedingAlloc) > 0 || (summary?.earningsPendingPublish ?? 0) > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {(summary?.shiftsRequiringAllocation ?? shiftsNeedingAlloc) > 0 && (
            <Link href="/shifts">
              <Card className="border-orange-200 bg-orange-50 cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="rounded-full bg-orange-100 p-2">
                    <AlertCircle className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-orange-700">Shifts Needing Allocation</p>
                    <p className="text-2xl font-bold text-orange-600">{summary?.shiftsRequiringAllocation ?? shiftsNeedingAlloc}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}
          {(summary?.earningsPendingPublish ?? 0) > 0 && (
            <Link href="/earnings">
              <Card className="border-yellow-200 bg-yellow-50 cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="rounded-full bg-yellow-100 p-2">
                    <DollarSign className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-yellow-700">Earnings Pending Publish</p>
                    <p className="text-2xl font-bold text-yellow-600">{summary?.earningsPendingPublish}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}
        </div>
      )}

      {/* Tables Row */}
      <div className="grid gap-4 xl:grid-cols-2">
        {/* Recent Applications */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Driver Applications</CardTitle>
            <Link href="/drivers" className="text-xs text-[#3DB324] hover:underline">View all →</Link>
          </CardHeader>
          <CardContent className="p-0">
            {loadingDrivers ? (
              <div className="p-4 space-y-2">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : recentDrivers.length === 0 ? (
              <p className="text-center text-gray-500 py-8 text-sm">No applications yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Fleet</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentDrivers.map((driver) => (
                    <TableRow key={driver.id}>
                      <TableCell className="font-medium">
                        <Link href={`/drivers/${driver.id}`} className="text-[#3DB324] hover:underline">
                          {driver.firstName} {driver.lastName}
                        </Link>
                      </TableCell>
                      <TableCell className="capitalize text-sm text-gray-500">{driver.fleetType ?? "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={driver.status === "approved" ? "default" : driver.status === "rejected" || driver.status === "suspended" ? "destructive" : "secondary"}
                          className={driver.status === "approved" ? "bg-[#3DB324] hover:bg-[#3DB324]" : ""}
                        >
                          {driver.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        {driver.createdAt ? format(new Date(driver.createdAt), "MMM d") : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Open Shifts This Week */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Open Shifts — This Week
            </CardTitle>
            <Link href="/shifts" className="text-xs text-[#3DB324] hover:underline">View all →</Link>
          </CardHeader>
          <CardContent className="p-0">
            {loadingShifts ? (
              <div className="p-4 space-y-2">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : openShiftsThisWeek.length === 0 ? (
              <p className="text-center text-gray-500 py-8 text-sm">No open shifts this week.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Fill Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openShiftsThisWeek.slice(0, 6).map((shift) => {
                    const fillPct = shift.capacity ? Math.round(((shift.confirmedCount ?? 0) / shift.capacity) * 100) : 0;
                    return (
                      <TableRow key={shift.id}>
                        <TableCell className="font-medium">
                          <Link href={`/shifts/${shift.id}`} className="text-[#3DB324] hover:underline">
                            {shift.title}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {format(new Date(shift.startTime), "EEE HH:mm")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 rounded-full bg-gray-200 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[#3DB324]"
                                style={{ width: `${Math.min(fillPct, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">
                              {shift.confirmedCount ?? 0}/{shift.capacity ?? "?"}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
