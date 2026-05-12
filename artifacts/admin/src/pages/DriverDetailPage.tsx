import { useState } from "react";
import { useRoute } from "wouter";
import {
  useAdminGetDriver,
  useAdminGetDriverDocuments,
  useAdminApproveDriver,
  useAdminRejectDriver,
  useAdminSuspendDriver,
  useAdminVerifyDocument,
  getAdminGetDriverQueryKey,
  getAdminGetDriverDocumentsQueryKey,
} from "@workspace/api-client-react";
import type { RejectDriverInput, SuspendDriverInput, DocumentVerifyInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { Link } from "wouter";

interface DriverProfile {
  id: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  idNumber?: string;
  streetAddress?: string;
  city?: string;
  fleetType?: string;
  status: string;
  telematicsSyncStatus?: string;
  agreementSigned?: boolean;
  bankName?: string;
  accountNumber?: string;
  branchCode?: string;
  accountType?: string;
}

interface DriverDoc {
  id: string;
  documentType: string;
  status: string;
  objectPath?: string;
  reviewNotes?: string;
}

interface DocumentsData {
  items: DriverDoc[];
}

export default function DriverDetailPage() {
  const [, params] = useRoute("/drivers/:id");
  const driverId = params?.id ?? "";
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: driverRes, isLoading: loadingDriver } = useAdminGetDriver(driverId);
  const driver = driverRes?.data as DriverProfile | undefined;

  const { data: docsRes, isLoading: loadingDocs } = useAdminGetDriverDocuments(driverId);
  const documents = (docsRes?.data as DocumentsData | undefined)?.items ?? [];

  const approveDriver = useAdminApproveDriver();
  const rejectDriver = useAdminRejectDriver();
  const suspendDriver = useAdminSuspendDriver();
  const verifyDoc = useAdminVerifyDocument();

  const [rejectReason, setRejectReason] = useState("");
  const [suspendReason, setSuspendReason] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);

  const handleApprove = () => {
    approveDriver.mutate({ driverId }, {
      onSuccess: () => {
        toast({ title: "Driver approved successfully" });
        queryClient.invalidateQueries({ queryKey: getAdminGetDriverQueryKey(driverId) });
      },
      onError: (err) => {
        toast({ title: "Error approving driver", description: err.message, variant: "destructive" });
      },
    });
  };

  const handleReject = () => {
    if (!rejectReason) { toast({ title: "Reason is required", variant: "destructive" }); return; }
    const data: RejectDriverInput = { reason: rejectReason };
    rejectDriver.mutate({ driverId, data }, {
      onSuccess: () => {
        toast({ title: "Driver rejected" });
        setRejectDialogOpen(false);
        setRejectReason("");
        queryClient.invalidateQueries({ queryKey: getAdminGetDriverQueryKey(driverId) });
      },
      onError: (err) => {
        toast({ title: "Error rejecting driver", description: err.message, variant: "destructive" });
      },
    });
  };

  const handleSuspend = () => {
    if (!suspendReason) { toast({ title: "Reason is required", variant: "destructive" }); return; }
    const data: SuspendDriverInput = { reason: suspendReason };
    suspendDriver.mutate({ driverId, data }, {
      onSuccess: () => {
        toast({ title: "Driver suspended" });
        setSuspendDialogOpen(false);
        setSuspendReason("");
        queryClient.invalidateQueries({ queryKey: getAdminGetDriverQueryKey(driverId) });
      },
      onError: (err) => {
        toast({ title: "Error suspending driver", description: err.message, variant: "destructive" });
      },
    });
  };

  const handleVerifyDoc = (docId: string, status: string, notes?: string) => {
    const data: DocumentVerifyInput = { status, reviewNotes: notes };
    verifyDoc.mutate({ driverId, documentId: docId, data }, {
      onSuccess: () => {
        toast({ title: `Document ${status}` });
        queryClient.invalidateQueries({ queryKey: getAdminGetDriverDocumentsQueryKey(driverId) });
      },
      onError: (err) => {
        toast({ title: "Error updating document", description: err.message, variant: "destructive" });
      },
    });
  };

  if (loadingDriver) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!driver) {
    return <div className="p-8 text-center text-gray-500">Driver not found</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex items-center gap-4">
        <Link href="/drivers">
          <Button variant="ghost" size="icon" data-testid="btn-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#1C2126] tracking-tight">{driver.firstName} {driver.lastName}</h1>
          <p className="text-gray-500">ID: {driver.id}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {(driver.status === 'submitted' || driver.status === 'pending') ? (
            <>
              <Button
                onClick={handleApprove}
                className="bg-[#3DB324] hover:bg-[#329b1d]"
                disabled={approveDriver.isPending}
                data-testid="btn-approve-driver"
              >
                <CheckCircle className="mr-2 h-4 w-4" /> Approve
              </Button>
              <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive" data-testid="btn-reject-trigger">
                    <XCircle className="mr-2 h-4 w-4" /> Reject
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Reject Driver Application</DialogTitle></DialogHeader>
                  <div className="py-4">
                    <Textarea
                      placeholder="Reason for rejection..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      data-testid="input-reject-reason"
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
                    <Button
                      variant="destructive"
                      onClick={handleReject}
                      disabled={rejectDriver.isPending}
                      data-testid="btn-confirm-reject"
                    >
                      Confirm Reject
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          ) : null}

          {driver.status === 'approved' ? (
            <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" data-testid="btn-suspend-trigger">
                  <AlertTriangle className="mr-2 h-4 w-4" /> Suspend
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Suspend Driver</DialogTitle></DialogHeader>
                <div className="py-4">
                  <Textarea
                    placeholder="Reason for suspension..."
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    data-testid="input-suspend-reason"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSuspendDialogOpen(false)}>Cancel</Button>
                  <Button
                    variant="destructive"
                    onClick={handleSuspend}
                    disabled={suspendDriver.isPending}
                    data-testid="btn-confirm-suspend"
                  >
                    Confirm Suspend
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Profile Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Fleet Type</p>
                <p className="capitalize">{driver.fleetType ?? '—'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Phone</p>
                <p>{driver.phone ?? '—'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">ID Number</p>
                <p>{driver.idNumber ?? '—'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Address</p>
                <p>{driver.streetAddress ? `${driver.streetAddress}, ${driver.city}` : '—'}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Banking Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Bank Name</p>
                <p>{driver.bankName ?? '—'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Account Number</p>
                <p>{driver.accountNumber ?? '—'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Branch Code</p>
                <p>{driver.branchCode ?? '—'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Account Type</p>
                <p className="capitalize">{driver.accountType ?? '—'}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>Review and verify submitted documents</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingDocs ? (
                <Skeleton className="h-32 w-full" />
              ) : documents.length === 0 ? (
                <p className="text-gray-500">No documents uploaded.</p>
              ) : (
                <div className="space-y-4">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium capitalize">{doc.documentType.replace(/_/g, ' ')}</p>
                        {doc.reviewNotes && <p className="text-xs text-gray-500 mt-0.5">{doc.reviewNotes}</p>}
                        <Badge
                          variant={doc.status === 'verified' ? 'default' : doc.status === 'rejected' ? 'destructive' : 'secondary'}
                          className="mt-1"
                        >
                          {doc.status}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        {doc.objectPath && (
                          <Button variant="outline" size="sm" onClick={() => window.open(doc.objectPath, '_blank')}>View</Button>
                        )}
                        {doc.status !== 'verified' && (
                          <Button
                            size="sm"
                            className="bg-[#3DB324] hover:bg-[#329b1d]"
                            onClick={() => handleVerifyDoc(doc.id, 'verified')}
                            disabled={verifyDoc.isPending}
                          >
                            Verify
                          </Button>
                        )}
                        {doc.status !== 'rejected' && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleVerifyDoc(doc.id, 'rejected')}
                            disabled={verifyDoc.isPending}
                          >
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
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Status Overview</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Application Status</p>
                <Badge
                  variant={driver.status === 'approved' ? 'default' : driver.status === 'rejected' || driver.status === 'suspended' ? 'destructive' : 'secondary'}
                  className="text-sm px-3 py-1"
                >
                  {driver.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Telematics Sync</p>
                <Badge
                  variant={
                    driver.telematicsSyncStatus === 'synced' ? 'outline' :
                    driver.telematicsSyncStatus === 'failed' ? 'destructive' :
                    'secondary'
                  }
                  className={`text-sm px-3 py-1 ${driver.telematicsSyncStatus === 'synced' ? 'border-[#3DB324] text-[#3DB324]' : ''}`}
                >
                  {driver.telematicsSyncStatus ?? 'pending'}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Agreement Signed</p>
                <Badge variant={driver.agreementSigned ? 'default' : 'secondary'} className="text-sm px-3 py-1">
                  {driver.agreementSigned ? 'Signed' : 'Pending'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
