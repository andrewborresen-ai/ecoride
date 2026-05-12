import { useState } from "react";
import {
  useAdminListAgreements,
  useAdminCreateAgreement,
  useAdminActivateAgreement,
  getAdminListAgreementsQueryKey,
} from "@workspace/api-client-react";
import type { AgreementInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface AgreementItem {
  id: string;
  title: string;
  version: string;
  fleetType?: string;
  isActive?: boolean;
  createdAt: string;
}

interface AgreementsData {
  items: AgreementItem[];
}

const EMPTY_AGREEMENT: AgreementInput = {
  title: "",
  version: "",
  content: "",
  fleetType: "electric",
};

export default function AgreementsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: agreementsRes, isLoading } = useAdminListAgreements();
  const agreements = (agreementsRes?.data as AgreementsData | undefined)?.items ?? [];

  const createAgreement = useAdminCreateAgreement();
  const activateAgreement = useAdminActivateAgreement();

  const [newAgreement, setNewAgreement] = useState<AgreementInput>(EMPTY_AGREEMENT);

  const handleCreate = () => {
    if (!newAgreement.title || !newAgreement.content) { toast({ title: "Fields required", variant: "destructive" }); return; }

    createAgreement.mutate({ data: newAgreement }, {
      onSuccess: () => {
        toast({ title: "Agreement created" });
        setCreateOpen(false);
        setNewAgreement(EMPTY_AGREEMENT);
        queryClient.invalidateQueries({ queryKey: getAdminListAgreementsQueryKey() });
      },
      onError: (err) => {
        toast({ title: "Error creating agreement", description: err.message, variant: "destructive" });
      },
    });
  };

  const handleActivate = (id: string) => {
    activateAgreement.mutate({ agreementId: id }, {
      onSuccess: () => {
        toast({ title: "Agreement activated" });
        queryClient.invalidateQueries({ queryKey: getAdminListAgreementsQueryKey() });
      },
      onError: (err) => {
        toast({ title: "Error activating agreement", description: err.message, variant: "destructive" });
      },
    });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#1C2126] tracking-tight">Agreements</h1>
          <p className="text-gray-500">Manage legal terms and versions.</p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#3DB324] hover:bg-[#329b1d]">
              <Plus className="mr-2 h-4 w-4" /> New Agreement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Create New Agreement Version</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    value={newAgreement.title}
                    onChange={(e) => setNewAgreement({ ...newAgreement, title: e.target.value })}
                    placeholder="e.g. Master Services Agreement"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Version</label>
                  <Input
                    value={newAgreement.version}
                    onChange={(e) => setNewAgreement({ ...newAgreement, version: e.target.value })}
                    placeholder="e.g. v2.1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Fleet Type</label>
                <Select
                  value={newAgreement.fleetType ?? "electric"}
                  onValueChange={(v) => setNewAgreement({ ...newAgreement, fleetType: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="electric">Electric (EcoRide)</SelectItem>
                    <SelectItem value="lpg">LPG (Khula Rides)</SelectItem>
                    <SelectItem value="all">All Fleets</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Content (Markdown / Plain Text)</label>
                <Textarea
                  className="h-64 font-mono text-sm"
                  value={newAgreement.content}
                  onChange={(e) => setNewAgreement({ ...newAgreement, content: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createAgreement.isPending} className="bg-[#3DB324] hover:bg-[#329b1d]">Save Agreement</Button>
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
                <TableHead>Version</TableHead>
                <TableHead>Fleet Type</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(3).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : agreements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">No agreements found.</TableCell>
                </TableRow>
              ) : (
                agreements.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.title}</TableCell>
                    <TableCell>{a.version}</TableCell>
                    <TableCell className="capitalize">{a.fleetType ?? '—'}</TableCell>
                    <TableCell className="text-sm text-gray-500">{format(new Date(a.createdAt), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <Badge
                        variant={a.isActive ? 'default' : 'secondary'}
                        className={a.isActive ? 'bg-[#3DB324] hover:bg-[#3DB324]' : ''}
                      >
                        {a.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {!a.isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleActivate(a.id)}
                          disabled={activateAgreement.isPending}
                        >
                          <CheckCircle className="mr-2 h-4 w-4" /> Activate
                        </Button>
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
