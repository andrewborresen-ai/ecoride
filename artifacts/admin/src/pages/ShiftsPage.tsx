import { useState } from "react";
import { useAdminListShifts, useAdminCreateShift } from "@workspace/api-client-react";
import { getAdminListShiftsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Link } from "wouter";

export default function ShiftsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shiftsRes, isLoading } = useAdminListShifts({});
  const shifts = (shiftsRes as any)?.data?.items || [];

  const createShift = useAdminCreateShift();
  const [newShift, setNewShift] = useState({
    title: "", fleetType: "electric", startTime: "", endTime: "", capacity: 10
  });

  const handleCreate = () => {
    if (!newShift.title || !newShift.startTime || !newShift.endTime) {
      toast({ title: "Required fields missing", variant: "destructive" }); return;
    }
    
    createShift.mutate({ data: {
      ...newShift, 
      startTime: new Date(newShift.startTime).toISOString(),
      endTime: new Date(newShift.endTime).toISOString(),
      capacity: Number(newShift.capacity)
    }}, {
      onSuccess: () => {
        toast({ title: "Shift created" });
        setCreateOpen(false);
        queryClient.invalidateQueries({ queryKey: getAdminListShiftsQueryKey({}) });
      },
      onError: (err: any) => {
        toast({ title: "Error creating shift", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1C2126] tracking-tight">Shifts</h1>
          <p className="text-gray-500">Manage shift schedules and capacities.</p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#3DB324] hover:bg-[#329b1d]" data-testid="btn-add-shift">
              <Plus className="mr-2 h-4 w-4" /> Create Shift
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Shift</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input value={newShift.title} onChange={e => setNewShift({...newShift, title: e.target.value})} placeholder="e.g. Morning Shift - Zone A" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Time</label>
                  <Input type="datetime-local" value={newShift.startTime} onChange={e => setNewShift({...newShift, startTime: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">End Time</label>
                  <Input type="datetime-local" value={newShift.endTime} onChange={e => setNewShift({...newShift, endTime: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Capacity</label>
                <Input type="number" value={newShift.capacity} onChange={e => setNewShift({...newShift, capacity: Number(e.target.value)})} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createShift.isPending} className="bg-[#3DB324] hover:bg-[#329b1d]">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Fleet Type</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  </TableRow>
                ))
              ) : shifts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">No shifts found.</TableCell>
                </TableRow>
              ) : (
                shifts.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      <Link href={`/shifts/${s.id}`} className="text-[#3DB324] hover:underline">
                        {s.title}
                      </Link>
                    </TableCell>
                    <TableCell className="capitalize">{s.fleetType}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {format(new Date(s.startTime), "MMM d, HH:mm")} - {format(new Date(s.endTime), "HH:mm")}
                    </TableCell>
                    <TableCell>{s.confirmedCount || 0} / {s.capacity}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === 'open' ? 'default' : s.status === 'full' ? 'secondary' : 'outline'}>{s.status}</Badge>
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
