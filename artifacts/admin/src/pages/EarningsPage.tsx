import { useState, useRef, useCallback } from "react";
import {
  useAdminListEarnings,
  useAdminCreateEarnings,
  useAdminUpdateEarnings,
  useAdminPublishEarnings,
  getAdminListEarningsQueryKey,
} from "@workspace/api-client-react";
import type { EarningsInput, EarningsUpdate } from "@workspace/api-client-react";
import { useAdminApi } from "@/lib/adminApi";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Upload, Eye, Download, AlertCircle, Check, Pencil, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface EarningsItem {
  id: string;
  driverProfileId: string;
  periodStart: string;
  periodEnd: string;
  grossAmountCents?: number;
  deductionsCents?: number;
  incentivesCents?: number;
  penaltiesCents?: number;
  netAmountCents?: number;
  tripCount?: number;
  notes?: string;
  status: string;
}


const fmt = (cents: number) => `R ${(cents / 100).toFixed(2)}`;

// --- CSV Utilities ---

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
  return { headers, rows };
}

const REQUIRED_FIELDS = ["driverProfileId", "periodStart", "periodEnd"] as const;
const OPTIONAL_FIELDS = [
  "grossAmountCents", "deductionsCents", "incentivesCents",
  "penaltiesCents", "netAmountCents", "tripCount", "notes",
] as const;
const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS] as const;
type EarningsField = (typeof ALL_FIELDS)[number];

const FIELD_LABELS: Record<EarningsField, string> = {
  driverProfileId: "Driver Profile ID *",
  periodStart: "Period Start *",
  periodEnd: "Period End *",
  grossAmountCents: "Gross Amount (cents)",
  deductionsCents: "Deductions (cents)",
  incentivesCents: "Incentives (cents)",
  penaltiesCents: "Penalties (cents)",
  netAmountCents: "Net Amount (cents)",
  tripCount: "Trip Count",
  notes: "Notes",
};

function buildEarningsInput(row: Record<string, string>, mapping: Record<EarningsField, string>): { data: EarningsInput | null; error: string | null } {
  const get = (field: EarningsField) => row[mapping[field]] ?? "";
  const driverProfileId = get("driverProfileId");
  const periodStart = get("periodStart");
  const periodEnd = get("periodEnd");
  if (!driverProfileId) return { data: null, error: "Missing driverProfileId" };
  if (!periodStart) return { data: null, error: "Missing periodStart" };
  if (!periodEnd) return { data: null, error: "Missing periodEnd" };
  const toInt = (f: EarningsField) => { const v = get(f); return v ? parseInt(v.replace(/[^0-9-]/g, ""), 10) : undefined; };
  const gross = toInt("grossAmountCents") ?? 0;
  const deductions = toInt("deductionsCents") ?? 0;
  const incentives = toInt("incentivesCents") ?? 0;
  const penalties = toInt("penaltiesCents") ?? 0;
  const net = toInt("netAmountCents") ?? gross - deductions - penalties + incentives;
  try {
    const data: EarningsInput = {
      driverProfileId,
      userId: driverProfileId,
      periodStart: new Date(periodStart).toISOString(),
      periodEnd: new Date(periodEnd).toISOString(),
      grossAmountCents: gross,
      deductionsCents: deductions,
      incentivesCents: incentives,
      penaltiesCents: penalties,
      netAmountCents: net,
      tripCount: toInt("tripCount"),
      notes: get("notes") || undefined,
    };
    return { data, error: null };
  } catch {
    return { data: null, error: "Invalid date format" };
  }
}

function downloadErrorReport(errors: Array<{ row: number; data: Record<string, string>; error: string }>, headers: string[]) {
  const csvLines = [
    [...headers, "_import_error"].join(","),
    ...errors.map((e) => [...headers.map((h) => e.data[h] ?? ""), e.error].join(",")),
  ];
  const blob = new Blob([csvLines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "earnings_import_errors.csv"; a.click();
  URL.revokeObjectURL(url);
}

type CsvStep = "upload" | "map" | "preview" | "importing" | "done";

function CsvImportWizard({ onClose, onCreate }: { onClose: () => void; onCreate: (data: EarningsInput) => Promise<void> }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [step, setStep] = useState<CsvStep>("upload");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<EarningsField, string>>({} as Record<EarningsField, string>);
  const [importResults, setImportResults] = useState<{ success: number; errors: Array<{ row: number; data: Record<string, string>; error: string }> }>({ success: 0, errors: [] });

  const handleFileSelect = () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers, rows } = parseCsv(text);
      if (headers.length === 0) { toast({ title: "Invalid CSV — no headers detected", variant: "destructive" }); return; }
      setCsvHeaders(headers);
      setCsvRows(rows);
      const autoMap = Object.fromEntries(ALL_FIELDS.map((f) => [f, headers.find((h) => h.toLowerCase() === f.toLowerCase()) ?? ""]));
      setMapping(autoMap as Record<EarningsField, string>);
      setStep("map");
    };
    reader.readAsText(file);
  };

  const handleImport = useCallback(async () => {
    setStep("importing");
    let success = 0;
    const errors: Array<{ row: number; data: Record<string, string>; error: string }> = [];
    for (let i = 0; i < csvRows.length; i++) {
      const row = csvRows[i];
      const { data, error } = buildEarningsInput(row, mapping);
      if (error || !data) { errors.push({ row: i + 2, data: row, error: error ?? "Unknown error" }); continue; }
      try { await onCreate(data); success++; } catch (err) { errors.push({ row: i + 2, data: row, error: (err as Error).message }); }
    }
    setImportResults({ success, errors });
    setStep("done");
  }, [csvRows, mapping, onCreate]);

  const NONE = "(skip)";

  return (
    <div className="min-h-[360px] flex flex-col">
      {step === "upload" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8">
          <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full h-40 border-dashed border-2 border-gray-300 rounded-xl bg-gray-50 flex flex-col items-center justify-center gap-2 hover:bg-gray-100 hover:border-[#3DB324] transition-colors">
            <Upload className="h-8 w-8 text-gray-400" />
            <span className="text-sm font-semibold text-gray-600">Click to upload CSV file</span>
            <span className="text-xs text-gray-400">Expected: driverProfileId, periodStart, periodEnd, amounts in cents</span>
          </button>
          <Button variant="outline" size="sm" onClick={() => {
            const sample = ["driverProfileId,periodStart,periodEnd,grossAmountCents,deductionsCents,incentivesCents,penaltiesCents,tripCount", "dp_abc123,2026-05-01,2026-05-07,120000,15000,5000,0,42"].join("\n");
            const blob = new Blob([sample], { type: "text/csv" });
            const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "earnings_template.csv"; a.click();
          }}><Download className="mr-2 h-4 w-4" /> Download Template</Button>
        </div>
      )}

      {step === "map" && (
        <div className="flex-1 space-y-4">
          <p className="text-sm text-gray-500"><strong>{csvHeaders.length}</strong> columns · <strong>{csvRows.length}</strong> data rows detected. Map fields below:</p>
          <div className="grid grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
            {ALL_FIELDS.map((field) => (
              <div key={field} className="space-y-1">
                <Label className={`text-xs ${REQUIRED_FIELDS.includes(field as typeof REQUIRED_FIELDS[number]) ? "text-[#3DB324] font-semibold" : "text-gray-500"}`}>{FIELD_LABELS[field]}</Label>
                <Select value={mapping[field] || NONE} onValueChange={(v) => setMapping({ ...mapping, [field]: v === NONE ? "" : v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{NONE}</SelectItem>
                    {csvHeaders.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
            <Button variant="outline" onClick={() => setStep("preview")}>Preview Data</Button>
            <Button className="ml-auto bg-[#3DB324] hover:bg-[#329b1d]" onClick={handleImport} disabled={!mapping.driverProfileId || !mapping.periodStart || !mapping.periodEnd}>Import {csvRows.length} Rows</Button>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="flex-1 space-y-3">
          <p className="text-sm text-gray-500">Preview of first 5 rows with current mapping:</p>
          <div className="overflow-x-auto rounded-lg border text-xs">
            <Table>
              <TableHeader><TableRow><TableHead>Driver ID</TableHead><TableHead>Period Start</TableHead><TableHead>Period End</TableHead><TableHead>Gross</TableHead><TableHead>Deductions</TableHead></TableRow></TableHeader>
              <TableBody>
                {csvRows.slice(0, 5).map((row, i) => {
                  const { data, error } = buildEarningsInput(row, mapping);
                  return (
                    <TableRow key={i} className={error ? "bg-red-50" : ""}>
                      <TableCell className="font-mono">{data?.driverProfileId ?? <span className="text-red-500">{error}</span>}</TableCell>
                      <TableCell>{data?.periodStart ? format(new Date(data.periodStart), "MMM d") : "—"}</TableCell>
                      <TableCell>{data?.periodEnd ? format(new Date(data.periodEnd), "MMM d, yyyy") : "—"}</TableCell>
                      <TableCell>{data ? fmt(data.grossAmountCents ?? 0) : "—"}</TableCell>
                      <TableCell>{data ? fmt(data.deductionsCents ?? 0) : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("map")}>Adjust Mapping</Button>
            <Button className="ml-auto bg-[#3DB324] hover:bg-[#329b1d]" onClick={handleImport}>Import All {csvRows.length} Rows</Button>
          </div>
        </div>
      )}

      {step === "importing" && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="h-10 w-10 border-4 border-[#3DB324] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-600 font-medium">Importing earnings data…</p>
            <p className="text-xs text-gray-400">{csvRows.length} rows to process</p>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-6">
          <Check className="h-12 w-12 text-[#3DB324]" />
          <div className="text-center">
            <p className="text-xl font-bold text-[#1C2126]">Import Complete</p>
            <p className="text-gray-500 mt-1"><span className="text-[#3DB324] font-semibold">{importResults.success} rows</span> imported{importResults.errors.length > 0 && <>, <span className="text-red-600 font-semibold">{importResults.errors.length} failed</span></>}.</p>
          </div>
          {importResults.errors.length > 0 && (
            <div className="w-full space-y-2">
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 max-h-32 overflow-y-auto">
                {importResults.errors.map((e, i) => <p key={i} className="text-xs text-red-700">Row {e.row}: {e.error}</p>)}
              </div>
              <Button variant="outline" size="sm" onClick={() => downloadErrorReport(importResults.errors, csvHeaders)} className="w-full">
                <Download className="mr-2 h-4 w-4" /> Download Error Report
              </Button>
            </div>
          )}
          <Button onClick={onClose} className="bg-[#3DB324] hover:bg-[#329b1d]">Done</Button>
        </div>
      )}
    </div>
  );
}

function EditEarningsDialog({ earning, onSave, isPending }: { earning: EarningsItem; onSave: (data: EarningsUpdate) => void; isPending: boolean }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<EarningsUpdate>({
    grossAmountCents: earning.grossAmountCents ?? 0,
    deductionsCents: earning.deductionsCents ?? 0,
    incentivesCents: earning.incentivesCents ?? 0,
    penaltiesCents: earning.penaltiesCents ?? 0,
    netAmountCents: earning.netAmountCents ?? 0,
    tripCount: earning.tripCount,
    notes: earning.notes ?? "",
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" data-testid={`btn-edit-earning-${earning.id}`}><Pencil className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Earnings Record</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          {(["grossAmountCents", "deductionsCents", "incentivesCents", "penaltiesCents"] as const).map((field) => (
            <div key={field} className="space-y-1.5">
              <Label className="text-xs capitalize">{field.replace(/([A-Z])/g, " $1").replace("Cents", " (¢)")}</Label>
              <Input type="number" value={form[field] ?? 0} onChange={(e) => setForm({ ...form, [field]: Number(e.target.value) })} />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label className="text-xs">Trip Count</Label>
            <Input type="number" value={form.tripCount ?? ""} onChange={(e) => setForm({ ...form, tripCount: Number(e.target.value) || undefined })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Input value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="col-span-2 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500">Net payout (auto-calculated)</p>
            <p className="text-xl font-bold text-[#3DB324]">{fmt(Math.max(0, (form.grossAmountCents ?? 0) - (form.deductionsCents ?? 0) - (form.penaltiesCents ?? 0) + (form.incentivesCents ?? 0)))}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => { const net = (form.grossAmountCents ?? 0) - (form.deductionsCents ?? 0) - (form.penaltiesCents ?? 0) + (form.incentivesCents ?? 0); onSave({ ...form, netAmountCents: Math.max(0, net) }); setOpen(false); }} disabled={isPending} className="bg-[#3DB324] hover:bg-[#329b1d]">Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function EarningsPage() {
  const [status, setStatus] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: earningsRes, isLoading } = useAdminListEarnings({ status: status !== "all" ? status : undefined });
  const earnings = (earningsRes?.data as EarningsItem[] | undefined) ?? [];

  const { unpublishEarnings } = useAdminApi();
  const createEarnings = useAdminCreateEarnings();
  const updateEarnings = useAdminUpdateEarnings();
  const publishEarnings = useAdminPublishEarnings();

  const [newEarning, setNewEarning] = useState({ driverProfileId: "", periodStart: "", periodEnd: "", grossAmountCents: "0", deductionsCents: "0", incentivesCents: "0", penaltiesCents: "0" });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getAdminListEarningsQueryKey({}) });

  const handleCreate = () => {
    if (!newEarning.driverProfileId || !newEarning.periodStart) { toast({ title: "Required fields missing", variant: "destructive" }); return; }
    const gross = Number(newEarning.grossAmountCents);
    const deductions = Number(newEarning.deductionsCents);
    const incentives = Number(newEarning.incentivesCents);
    const penalties = Number(newEarning.penaltiesCents);
    const data: EarningsInput = { driverProfileId: newEarning.driverProfileId, userId: newEarning.driverProfileId, periodStart: new Date(newEarning.periodStart).toISOString(), periodEnd: new Date(newEarning.periodEnd).toISOString(), grossAmountCents: gross, deductionsCents: deductions, incentivesCents: incentives, penaltiesCents: penalties, netAmountCents: gross - deductions - penalties + incentives };
    createEarnings.mutate({ data }, {
      onSuccess: () => { toast({ title: "Earnings record created" }); setCreateOpen(false); invalidate(); },
      onError: (err) => toast({ title: "Error creating earnings", description: err.message, variant: "destructive" }),
    });
  };

  const handleUpdate = (earningsId: string, data: EarningsUpdate) => {
    updateEarnings.mutate({ earningsId, data }, {
      onSuccess: () => { toast({ title: "Earnings updated" }); invalidate(); },
      onError: (err) => toast({ title: "Error updating", description: err.message, variant: "destructive" }),
    });
  };

  const handlePublish = (id: string) => {
    publishEarnings.mutate({ earningsId: id }, {
      onSuccess: () => { toast({ title: "Earnings published to driver" }); invalidate(); },
      onError: (err) => toast({ title: "Failed to publish", description: err.message, variant: "destructive" }),
    });
  };

  const handleUnpublish = async (id: string) => {
    try {
      await unpublishEarnings(id);
      toast({ title: "Earnings recalled to draft" });
      invalidate();
    } catch (err) {
      toast({ title: "Failed to unpublish", description: (err as Error).message, variant: "destructive" });
    }
  };

  const csvCreate = useCallback(async (data: EarningsInput): Promise<void> => {
    return new Promise((resolve, reject) => {
      createEarnings.mutate({ data }, { onSuccess: () => resolve(), onError: (err) => reject(err) });
    });
  }, [createEarnings]);

  const draftCount = earnings.filter((e) => e.status === "draft").length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-[#1C2126] tracking-tight">Earnings</h1>
          <p className="text-gray-500">Manage driver payouts, deductions, and statements.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={csvOpen} onOpenChange={setCsvOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="btn-import-csv"><Upload className="mr-2 h-4 w-4" /> Import CSV</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Import Earnings via CSV</DialogTitle></DialogHeader>
              <CsvImportWizard onClose={() => { setCsvOpen(false); invalidate(); }} onCreate={csvCreate} />
            </DialogContent>
          </Dialog>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#3DB324] hover:bg-[#329b1d]"><Plus className="mr-2 h-4 w-4" /> Manual Entry</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Manual Earnings Record</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="col-span-2 space-y-1.5"><Label>Driver Profile ID *</Label><Input value={newEarning.driverProfileId} onChange={(e) => setNewEarning({ ...newEarning, driverProfileId: e.target.value })} placeholder="dp_..." className="font-mono" /></div>
                <div className="space-y-1.5"><Label>Period Start *</Label><Input type="date" value={newEarning.periodStart} onChange={(e) => setNewEarning({ ...newEarning, periodStart: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Period End *</Label><Input type="date" value={newEarning.periodEnd} onChange={(e) => setNewEarning({ ...newEarning, periodEnd: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Gross (Cents)</Label><Input type="number" min="0" value={newEarning.grossAmountCents} onChange={(e) => setNewEarning({ ...newEarning, grossAmountCents: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Deductions (Cents)</Label><Input type="number" min="0" value={newEarning.deductionsCents} onChange={(e) => setNewEarning({ ...newEarning, deductionsCents: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Incentives (Cents)</Label><Input type="number" min="0" value={newEarning.incentivesCents} onChange={(e) => setNewEarning({ ...newEarning, incentivesCents: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Penalties (Cents)</Label><Input type="number" min="0" value={newEarning.penaltiesCents} onChange={(e) => setNewEarning({ ...newEarning, penaltiesCents: e.target.value })} /></div>
                <div className="col-span-2 p-3 bg-gray-50 rounded-lg"><p className="text-sm text-gray-500">Net payout</p><p className="text-xl font-bold text-[#3DB324]">{fmt(Math.max(0, Number(newEarning.grossAmountCents) - Number(newEarning.deductionsCents) - Number(newEarning.penaltiesCents) + Number(newEarning.incentivesCents)))}</p></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={createEarnings.isPending} className="bg-[#3DB324] hover:bg-[#329b1d]">Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {draftCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0" />
          <p className="text-sm text-yellow-800"><strong>{draftCount}</strong> draft record{draftCount !== 1 ? "s" : ""} — publish to make visible to drivers.</p>
        </div>
      )}

      <div className="flex gap-4">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
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
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right text-[#3DB324]">Net Payout</TableHead>
                <TableHead>Trips</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => <TableRow key={i}>{Array(8).fill(0).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>)}</TableRow>)
              ) : earnings.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-gray-500">No earnings records found.</TableCell></TableRow>
              ) : (
                earnings.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs text-gray-600">{e.driverProfileId.slice(0, 10)}…</TableCell>
                    <TableCell className="text-sm">{format(new Date(e.periodStart), "MMM d")} – {format(new Date(e.periodEnd), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-right">{fmt(e.grossAmountCents ?? 0)}</TableCell>
                    <TableCell className="text-right text-red-600">-{fmt((e.deductionsCents ?? 0) + (e.penaltiesCents ?? 0))}</TableCell>
                    <TableCell className="text-right font-bold text-[#3DB324]">{fmt(e.netAmountCents ?? 0)}</TableCell>
                    <TableCell className="text-center">{e.tripCount ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={e.status === "published" ? "default" : "secondary"} className={e.status === "published" ? "bg-[#3DB324] hover:bg-[#3DB324]" : ""}>{e.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <EditEarningsDialog earning={e} onSave={(data) => handleUpdate(e.id, data)} isPending={updateEarnings.isPending} />
                        {e.status === "draft" ? (
                          <Button size="sm" variant="outline" className="border-[#3DB324] text-[#3DB324] hover:bg-[#3DB324] hover:text-white" onClick={() => handlePublish(e.id)} disabled={publishEarnings.isPending} data-testid={`btn-publish-${e.id}`}>
                            Publish
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" className="text-gray-500" onClick={() => handleUnpublish(e.id)} disabled={updateEarnings.isPending} data-testid={`btn-unpublish-${e.id}`} title="Recall to draft">
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                        {e.status === "published" && (
                          <Button size="sm" variant="ghost" disabled className="text-gray-400">
                            <Eye className="h-4 w-4 mr-1" /> View
                          </Button>
                        )}
                      </div>
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
