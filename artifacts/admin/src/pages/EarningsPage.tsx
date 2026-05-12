import { useState, useRef } from "react";
import { useAdminListEarnings, useAdminCreateEarnings, useAdminPublishEarnings, getAdminListEarningsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Download, Upload, Eye } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function EarningsPage() {
  const [status, setStatus] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: earningsRes, isLoading } = useAdminListEarnings({
    status: status !== "all" ? status : undefined
  });
  
  const earnings = (earningsRes as any)?.data?.items || [];

  const createEarnings = useAdminCreateEarnings();
  const publishEarnings = useAdminPublishEarnings();

  const [newEarning, setNewEarning] = useState({
    driverProfileId: "", userId: "mock-user-id", periodStart: "", periodEnd: "",
    grossAmountCents: 0, deductionsCents: 0, incentivesCents: 0, penaltiesCents: 0
  });

  const handleCreate = () => {
    if (!newEarning.driverProfileId || !newEarning.periodStart) {
      toast({ title: "Required fields missing", variant: "destructive" }); return;
    }
    const net = Number(newEarning.grossAmountCents) - Number(newEarning.deductionsCents) - Number(newEarning.penaltiesCents) + Number(newEarning.incentivesCents);
    
    createEarnings.mutate({ data: {
      ...newEarning,
      periodStart: new Date(newEarning.periodStart).toISOString(),
      periodEnd: new Date(newEarning.periodEnd).toISOString(),
      grossAmountCents: Number(newEarning.grossAmountCents),
      deductionsCents: Number(newEarning.deductionsCents),
      incentivesCents: Number(newEarning.incentivesCents),
      penaltiesCents: Number(newEarning.penaltiesCents),
      netAmountCents: net
    }}, {
      onSuccess: () => {
        toast({ title: "Earnings record created" });
        setCreateOpen(false);
        queryClient.invalidateQueries({ queryKey: getAdminListEarningsQueryKey({}) });
      }
    });
  };

  const handlePublish = (id: string) => {
    publishEarnings.mutate({ earningsId: id }, {
      onSuccess: () => {
        toast({ title: "Earnings published" });
        queryClient.invalidateQueries({ queryKey: getAdminListEarningsQueryKey({}) });
      },
      onError: (err: any) => {
        toast({ title: "Failed to publish", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleCsvImport = () => {
    // Mock CSV Import
    toast({ title: "CSV Imported Successfully", description: "3 draft earnings records created." });
    setCsvOpen(false);
    queryClient.invalidateQueries({ queryKey: getAdminListEarningsQueryKey({}) });
  };

  const formatCurrency = (cents: number) => {
    return `ZAR ${(cents / 100).toFixed(2)}`;
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#1C2126] tracking-tight">Earnings</h1>
          <p className="text-gray-500">Manage driver payouts, deductions and statements.</p>
        </div>

        <div className="flex gap-2">
          <Dialog open={csvOpen} onOpenChange={setCsvOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="btn-import-csv"><Upload className="mr-2 h-4 w-4" /> Import CSV</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import Earnings via CSV</DialogTitle>
              </DialogHeader>
              <div className="py-8 text-center space-y-4">
                <Input type="file" accept=".csv" ref={fileInputRef} className="hidden" />
                <Button variant="secondary" onClick={() => fileInputRef.current?.click()} className="w-full h-32 border-dashed border-2 bg-gray-50">
                  <div className="flex flex-col items-center">
                    <Upload className="h-8 w-8 text-gray-400 mb-2" />
                    <span className="text-sm font-medium">Click to select CSV file</span>
                  </div>
                </Button>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCsvOpen(false)}>Cancel</Button>
                <Button onClick={handleCsvImport} className="bg-[#3DB324] hover:bg-[#329b1d]">Import Data</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#3DB324] hover:bg-[#329b1d]">
                <Plus className="mr-2 h-4 w-4" /> Manual Entry
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Manual Earnings Record</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="space-y-2 col-span-2">
                  <label className="text-sm font-medium">Driver Profile ID</label>
                  <Input value={newEarning.driverProfileId} onChange={e => setNewEarning({...newEarning, driverProfileId: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Period Start</label>
                  <Input type="date" value={newEarning.periodStart} onChange={e => setNewEarning({...newEarning, periodStart: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Period End</label>
                  <Input type="date" value={newEarning.periodEnd} onChange={e => setNewEarning({...newEarning, periodEnd: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Gross (Cents)</label>
                  <Input type="number" value={newEarning.grossAmountCents} onChange={e => setNewEarning({...newEarning, grossAmountCents: Number(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Deductions (Cents)</label>
                  <Input type="number" value={newEarning.deductionsCents} onChange={e => setNewEarning({...newEarning, deductionsCents: Number(e.target.value)})} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={createEarnings.isPending} className="bg-[#3DB324] hover:bg-[#329b1d]">Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex gap-4">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Driver ID</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right text-red-600">Deductions</TableHead>
                <TableHead className="text-right text-[#3DB324]">Net Payout</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : earnings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">No earnings records found.</TableCell>
                </TableRow>
              ) : (
                earnings.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.driverProfileId.slice(0,8)}...</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {format(new Date(e.periodStart), "MMM d")} - {format(new Date(e.periodEnd), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(e.grossAmountCents || 0)}</TableCell>
                    <TableCell className="text-right text-red-600">-{formatCurrency((e.deductionsCents || 0) + (e.penaltiesCents || 0))}</TableCell>
                    <TableCell className="text-right font-bold text-[#3DB324]">{formatCurrency(e.netAmountCents || 0)}</TableCell>
                    <TableCell>
                      <Badge variant={e.status === 'published' ? 'default' : 'secondary'} className={e.status === 'published' ? 'bg-[#3DB324] hover:bg-[#3DB324]' : ''}>
                        {e.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {e.status === 'draft' ? (
                        <Button size="sm" variant="outline" className="border-[#3DB324] text-[#3DB324] hover:bg-[#3DB324] hover:text-white" onClick={() => handlePublish(e.id)} disabled={publishEarnings.isPending} data-testid={`btn-publish-${e.id}`}>
                          Publish
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" disabled><Eye className="h-4 w-4 mr-2" /> View</Button>
                      )}
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
