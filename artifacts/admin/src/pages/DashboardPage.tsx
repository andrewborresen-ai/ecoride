import { useGetAdminDashboardSummary, useAdminListDrivers, useAdminListShifts } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Users, Car, CalendarDays, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

interface DashboardSummary {
  totalDrivers?: number;
  activeVehicles?: number;
  openShifts?: number;
  pendingApplications?: number;
  shiftsRequiringAllocation?: number;
  earningsPendingPublish?: number;
}

interface DriverItem {
  id: string;
  firstName?: string;
  lastName?: string;
  status: string;
  createdAt?: string;
}

interface ShiftItem {
  id: string;
  title?: string;
  startTime: string;
  endTime: string;
  capacity?: number;
  confirmedCount?: number;
}

interface ListData<T> {
  items: T[];
}

export default function DashboardPage() {
  const { data: summaryRes, isLoading: loadingSummary } = useGetAdminDashboardSummary();
  const summary = summaryRes?.data as DashboardSummary | undefined;

  const { data: driversRes, isLoading: loadingDrivers } = useAdminListDrivers({ limit: 5 });
  const drivers = (driversRes?.data as ListData<DriverItem> | undefined)?.items ?? [];

  const { data: shiftsRes, isLoading: loadingShifts } = useAdminListShifts({ status: "open" });
  const shifts = ((shiftsRes?.data as ListData<ShiftItem> | undefined)?.items ?? []).slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1C2126] tracking-tight">Dashboard</h1>
        <p className="text-gray-500">Overview of EcoRide Fleet Operations.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loadingSummary ? (
          Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Total Drivers</CardTitle>
                <Users className="h-4 w-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.totalDrivers ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Active Vehicles</CardTitle>
                <Car className="h-4 w-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.activeVehicles ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Open Shifts</CardTitle>
                <CalendarDays className="h-4 w-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.openShifts ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Pending Applications</CardTitle>
                <Users className="h-4 w-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{summary?.pendingApplications ?? 0}</div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {(summary?.shiftsRequiringAllocation ?? 0) > 0 || (summary?.earningsPendingPublish ?? 0) > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4 flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-orange-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-orange-700">Shifts needing allocation</p>
                <p className="text-2xl font-bold text-orange-600">{summary?.shiftsRequiringAllocation ?? 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-4 flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-yellow-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-yellow-700">Earnings pending publish</p>
                <p className="text-2xl font-bold text-yellow-600">{summary?.earningsPendingPublish ?? 0}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Recent Driver Applications</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDrivers ? (
              <div className="space-y-2">
                {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drivers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-gray-500 py-4">No recent applications.</TableCell>
                    </TableRow>
                  ) : (
                    drivers.map((driver) => (
                      <TableRow key={driver.id}>
                        <TableCell className="font-medium">
                          <Link href={`/drivers/${driver.id}`} className="text-[#3DB324] hover:underline">
                            {driver.firstName} {driver.lastName}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant={driver.status === 'approved' ? 'default' : 'secondary'}>
                            {driver.status}
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
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Upcoming Open Shifts</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingShifts ? (
              <div className="space-y-2">
                {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Capacity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shifts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-gray-500 py-4">No open shifts.</TableCell>
                    </TableRow>
                  ) : (
                    shifts.map((shift) => (
                      <TableRow key={shift.id}>
                        <TableCell className="font-medium">
                          <Link href={`/shifts/${shift.id}`} className="text-[#3DB324] hover:underline">
                            {shift.title}
                          </Link>
                        </TableCell>
                        <TableCell className="text-gray-500">
                          {format(new Date(shift.startTime), "MMM d, HH:mm")}
                        </TableCell>
                        <TableCell>
                          {shift.confirmedCount ?? 0} / {shift.capacity ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
