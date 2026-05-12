import { useState, useEffect, useCallback } from "react";
import { useRoute } from "wouter";
import {
  useAdminGetDriver,
  useAdminGetDriverDocuments,
  useAdminApproveDriver,
  useAdminRejectDriver,
  useAdminSuspendDriver,
  useAdminVerifyDocument,
  useAdminListVehicleAssignments,
  useAdminListEarnings,
  getAdminGetDriverQueryKey,
  getAdminGetDriverDocumentsQueryKey,
} from "@workspace/api-client-react";
import type { RejectDriverInput, SuspendDriverInput, DocumentVerifyInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, RefreshCcw, FileSignature, Clock, DollarSign, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useAdminApi } from "@/lib/adminApi";

interface DriverProfile {
  id: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  idNumber?: string;
  streetAddress?: string;
  suburb?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  fleetType?: string;
  status: string;
  telematicsSyncStatus?: string;
  agreementSigned?: boolean;
  agreementSignedAt?: string;
  bankName?: string;
  accountNumber?: string;
  branchCode?: string;
  accountType?: string;
  boltDriverId?: string;
}

interface DriverDoc {
  id: string;
  documentType: string;
  status: string;
  objectPath?: string;
  reviewNotes?: string;
}

interface AssignmentItem {
  id: string;
  shiftId?: string;
  vehicleId: string;
  assignmentStart: string;
  assignmentEnd: string;
  status?: string;
}

interface EarningsItem {
  id: string;
  periodStart: string;
  periodEnd: string;
  grossAmountCents?: number;
  deductionsCents?: number;
  netAmountCents?: number;
  status: string;
}

const fmt = (cents: number) => `R ${(cents / 100).toFixed(2)}`;

export default function DriverDetailPage() {
  const [, params] = useRoute("/drivers/:id");
  const driverId = params?.id ?? "";
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [rejectOpen, setRejectOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [suspendReason, setSuspendReason] = useState("");
  const [notes, setNotes] = useState<string>("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [retryingTelematics, setRetryingTelematics] = useState(false);
  const { getDriverNotes, patchDriverNotes, retryTelematics } = useAdminApi();

  const loadNotes = useCallback(async () => {
    try { const res = await getDriverNotes(driverId); setNotes((res?.data as { notes?: string } | undefined)?.notes ?? ""); } catch { /* noop */ }
  }, [driverId, getDriverNotes]);

  useEffect(() => { void loadNotes(); }, [loadNotes]);

  const { data: driverRes, isLoading: loadingDriver } = useAdminGetDriver(driverId);
  const driverDetail = driverRes?.data as { profile: DriverProfile; user: unknown; documents: DriverDoc[] } | undefined;
  const driver = driverDetail?.profile;

  const { data: docsRes, isLoading: loadingDocs } = useAdminGetDriverDocuments(driverId);
  const documents = (docsRes?.data as DriverDoc[] | undefined) ?? [];

  const { data: assignmentsRes, isLoading: loadingAssignments } = useAdminListVehicleAssignments({ driverProfileId: driverId });
  const assignments = (assignmentsRes?.data as AssignmentItem[] | undefined) ?? [];

  const { data: earningsRes, isLoading: loadingEarnings } = useAdminListEarnings({ driverProfileId: driverId });
  const earningsList = (earningsRes?.data as EarningsItem[] | undefined) ?? [];

  const approveDriver = useAdminApproveDriver();
  const rejectDriver = useAdminRejectDriver();
  const suspendDriver = useAdminSuspendDriver();
  const verifyDoc = useAdminVerifyDocument();

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getAdminGetDriverQueryKey(driverId) });
    queryClient.invalidateQueries({ queryKey: getAdminGetDriverDocumentsQueryKey(driverId) });
  };

  const handleApprove = () => {
    approveDriver.mutate({ driverId }, {
      onSuccess: () => { toast({ title: "Driver approved" }); refresh(); setApproveConfirmOpen(false); },
      onError: (err) => toast({ title: "Error approving", description: err.message, variant: "destructive" }),
    });
  };

  const handleReject = () => {
    if (!rejectReason.trim()) { toast({ title: "Reason required", variant: "destructive" }); return; }
    const data: RejectDriverInput = { reason: rejectReason };
    rejectDriver.mutate({ driverId, data }, {
      onSuccess: () => { toast({ title: "Driver rejected" }); setRejectOpen(false); setRejectReason(""); refresh(); },
      onError: (err) => toast({ title: "Error rejecting", description: err.message, variant: "destructive" }),
    });
  };

  const handleSuspend = () => {
    if (!suspendReason.trim()) { toast({ title: "Reason required", variant: "destructive" }); return; }
    const data: SuspendDriverInput = { reason: suspendReason };
    suspendDriver.mutate({ driverId, data }, {
      onSuccess: () => { toast({ title: "Driver suspended" }); setSuspendOpen(false); setSuspendReason(""); refresh(); },
      onError: (err) => toast({ title: "Error suspending", description: err.message, variant: "destructive" }),
    });
  };

  const handleVerifyDoc = (docId: string, status: string) => {
    const data: DocumentVerifyInput = { status };
    verifyDoc.mutate({ driverId, documentId: docId, data }, {
      onSuccess: () => { toast({ title: `Document ${status}` }); queryClient.invalidateQueries({ queryKey: getAdminGetDriverDocumentsQueryKey(driverId) }); },
      onError: (err) => toast({ title: "Error updating document", description: err.message, variant: "destructive" }),
    });
  };

  const handleRetryTelematics = async () => {
    setRetryingTelematics(true);
    try {
      await retryTelematics(driverId);
      toast({ title: "Telematics sync queued", description: "Re-registration submitted. Status will update shortly." });
      refresh();
    } catch (err) {
      toast({ title: "Telematics retry failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setRetryingTelematics(false);
    }
  };

  const saveNotes = async () => {
    setNotesSaving(true);
    try {
      await patchDriverNotes(driverId, notes);
      toast({ title: "Notes saved" });
    } catch {
      toast({ title: "Failed to save notes", variant: "destructive" });
    } finally {
      setNotesSaving(false);
    }
  };

  const canApprove = driver?.status === "submitted" || driver?.status === "pending";

  if (loadingDriver) return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-64 w-full" />
    </div>
  );

  if (!driver) return <div className="p-8 text-center text-gray-500">Driver not found.</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Approve confirmation */}
      <AlertDialog open={approveConfirmOpen} onOpenChange={setApproveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve {driver.firstName} {driver.lastName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will approve the driver's application and allow them to sign up for shifts.
              Make sure all required documents have been verified before approving.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#3DB324] hover:bg-[#329b1d]"
              onClick={handleApprove}
            >
              Confirm Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Driver Application</DialogTitle></DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Reason for rejection (will be shared with the driver)..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="h-28"
              data-testid="input-reject-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejectDriver.isPending} data-testid="btn-confirm-reject">
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend dialog */}
      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Suspend Driver</DialogTitle></DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Reason for suspension (will be shared with the driver)..."
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              className="h-28"
              data-testid="input-suspend-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleSuspend} disabled={suspendDriver.isPending} data-testid="btn-confirm-suspend">
              Confirm Suspend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/drivers">
          <Button variant="ghost" size="icon" data-testid="btn-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#1C2126] tracking-tight">
            {driver.firstName} {driver.lastName}
          </h1>
          <p className="text-gray-500 font-mono text-xs mt-0.5">{driver.id}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {driver.telematicsSyncStatus !== "synced" && (
            <Button variant="outline" size="sm" onClick={handleRetryTelematics} disabled={retryingTelematics} data-testid="btn-retry-telematics">
              {retryingTelematics ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              {retryingTelematics ? "Retrying…" : "Retry Telematics"}
            </Button>
          )}
          {canApprove && (
            <>
              <Button
                onClick={() => setApproveConfirmOpen(true)}
                className="bg-[#3DB324] hover:bg-[#329b1d]"
                disabled={approveDriver.isPending}
                data-testid="btn-approve-driver"
              >
                <CheckCircle className="mr-2 h-4 w-4" /> Approve
              </Button>
              <Button variant="destructive" onClick={() => setRejectOpen(true)} data-testid="btn-reject-trigger">
                <XCircle className="mr-2 h-4 w-4" /> Reject
              </Button>
            </>
          )}
          {driver.status === "approved" && (
            <Button variant="destructive" onClick={() => setSuspendOpen(true)} data-testid="btn-suspend-trigger">
              <AlertTriangle className="mr-2 h-4 w-4" /> Suspend
            </Button>
          )}
        </div>
      </div>

      {/* Status row */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: "Status", value: driver.status, color: driver.status === "approved" ? "bg-green-100 text-green-800" : driver.status === "rejected" || driver.status === "suspended" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-700" },
          { label: "Fleet", value: driver.fleetType ?? "—", color: "bg-blue-100 text-blue-800" },
          { label: "Telematics", value: driver.telematicsSyncStatus ?? "pending", color: driver.telematicsSyncStatus === "synced" ? "bg-green-100 text-green-800" : driver.telematicsSyncStatus === "failed" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-700" },
          { label: "Agreement", value: driver.agreementSigned ? "Signed" : "Pending", color: driver.agreementSigned ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">{item.label}:</span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${item.color}`}>{item.value}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-5 max-w-2xl">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="documents">Docs ({documents.length})</TabsTrigger>
          <TabsTrigger value="shifts">Shifts ({assignments.length})</TabsTrigger>
          <TabsTrigger value="earnings">Earnings ({earningsList.length})</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>Personal Details</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: "Phone", value: driver.phone },
                  { label: "ID Number", value: driver.idNumber },
                  { label: "Street", value: driver.streetAddress },
                  { label: "Suburb", value: driver.suburb },
                  { label: "City", value: driver.city },
                  { label: "Province", value: driver.province },
                  { label: "Postal Code", value: driver.postalCode },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-gray-500 text-xs">{label}</p>
                    <p className="font-medium">{value ?? "—"}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Banking Details</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: "Bank Name", value: driver.bankName },
                  { label: "Account Number", value: driver.accountNumber },
                  { label: "Branch Code", value: driver.branchCode },
                  { label: "Account Type", value: driver.accountType },
                  { label: "Bolt Driver ID", value: driver.boltDriverId },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-gray-500 text-xs">{label}</p>
                    <p className="font-medium">{value ?? "—"}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Agreement Signature Card */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-3">
              <FileSignature className="h-5 w-5 text-gray-400" />
              <div>
                <CardTitle>Agreement Signature</CardTitle>
                <CardDescription>Driver's agreement status for this fleet type</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {driver.agreementSigned ? (
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-[#3DB324]" />
                  <div>
                    <p className="font-semibold text-[#3DB324]">Agreement Signed</p>
                    {driver.agreementSignedAt && (
                      <p className="text-xs text-gray-500">Signed {format(new Date(driver.agreementSignedAt), "PPP")}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Clock className="h-6 w-6 text-yellow-500" />
                  <div>
                    <p className="font-semibold text-yellow-700">Agreement Pending</p>
                    <p className="text-xs text-gray-500">The driver has not yet signed the active agreement for their fleet type.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Submitted Documents</CardTitle>
              <CardDescription>Review and verify each document</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingDocs ? <Skeleton className="h-32 w-full" /> : documents.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No documents submitted yet.</p>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-1">
                        <p className="font-medium capitalize">{doc.documentType.replace(/_/g, " ")}</p>
                        {doc.reviewNotes && <p className="text-xs text-gray-500">{doc.reviewNotes}</p>}
                        <Badge
                          variant={doc.status === "verified" ? "default" : doc.status === "rejected" ? "destructive" : "secondary"}
                          className={doc.status === "verified" ? "bg-[#3DB324] hover:bg-[#3DB324]" : ""}
                        >
                          {doc.status}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        {doc.objectPath && (
                          <Button size="sm" variant="outline" onClick={() => window.open(doc.objectPath, "_blank")}>View</Button>
                        )}
                        {doc.status !== "verified" && (
                          <Button size="sm" className="bg-[#3DB324] hover:bg-[#329b1d]" onClick={() => handleVerifyDoc(doc.id, "verified")} disabled={verifyDoc.isPending}>
                            Verify
                          </Button>
                        )}
                        {doc.status !== "rejected" && (
                          <Button size="sm" variant="destructive" onClick={() => handleVerifyDoc(doc.id, "rejected")} disabled={verifyDoc.isPending}>
                            Reject
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Shifts Tab */}
        <TabsContent value="shifts" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Shift History</CardTitle>
              <CardDescription>All vehicle assignments for this driver</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingAssignments ? <div className="p-4"><Skeleton className="h-24 w-full" /></div> : assignments.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No shift assignments found.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vehicle ID</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>End</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-xs">{a.vehicleId.slice(0, 10)}…</TableCell>
                        <TableCell className="text-sm">{format(new Date(a.assignmentStart), "MMM d, yyyy HH:mm")}</TableCell>
                        <TableCell className="text-sm">{format(new Date(a.assignmentEnd), "MMM d, yyyy HH:mm")}</TableCell>
                        <TableCell>
                          <Badge variant={a.status === "active" ? "default" : "secondary"}>{a.status ?? "—"}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Earnings Tab */}
        <TabsContent value="earnings" className="mt-4">
          {loadingEarnings ? <Skeleton className="h-48 w-full" /> : (
            <div className="space-y-4">
              {/* Summary stats */}
              {earningsList.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-gray-500">Total Gross</p>
                      <p className="text-xl font-bold">{fmt(earningsList.reduce((s, e) => s + (e.grossAmountCents ?? 0), 0))}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-gray-500">Total Deductions</p>
                      <p className="text-xl font-bold text-red-600">-{fmt(earningsList.reduce((s, e) => s + (e.deductionsCents ?? 0), 0))}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-gray-500">Total Net</p>
                      <p className="text-xl font-bold text-[#3DB324]">{fmt(earningsList.reduce((s, e) => s + (e.netAmountCents ?? 0), 0))}</p>
                    </CardContent>
                  </Card>
                </div>
              )}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> Earnings Records</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {earningsList.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No earnings records yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Period</TableHead>
                          <TableHead className="text-right">Gross</TableHead>
                          <TableHead className="text-right">Deductions</TableHead>
                          <TableHead className="text-right">Net</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {earningsList.map((e) => (
                          <TableRow key={e.id}>
                            <TableCell className="text-sm">
                              {format(new Date(e.periodStart), "MMM d")} – {format(new Date(e.periodEnd), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="text-right">{fmt(e.grossAmountCents ?? 0)}</TableCell>
                            <TableCell className="text-right text-red-600">-{fmt(e.deductionsCents ?? 0)}</TableCell>
                            <TableCell className="text-right font-bold text-[#3DB324]">{fmt(e.netAmountCents ?? 0)}</TableCell>
                            <TableCell>
                              <Badge variant={e.status === "published" ? "default" : "secondary"} className={e.status === "published" ? "bg-[#3DB324] hover:bg-[#3DB324]" : ""}>
                                {e.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Internal Notes</CardTitle>
              <CardDescription>Admin-only notes about this driver. Saved locally in your browser.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                className="h-48 font-mono text-sm"
                placeholder="Add internal notes about this driver here..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <Button onClick={saveNotes} disabled={notesSaving} className="bg-[#3DB324] hover:bg-[#329b1d]">
                {notesSaving ? "Saving…" : "Save Notes"}
              </Button>
              <p className="text-xs text-gray-400">Notes are shared across all admins and stored securely on the server.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
