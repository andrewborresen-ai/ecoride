import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  useAdminListEarnings,
  useAdminCreateEarnings,
  useAdminUpdateEarnings,
  useAdminPublishEarnings,
  useAdminListDrivers,
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
import { Plus, Eye, AlertCircle, Check, Pencil, RotateCcw, FileSpreadsheet, ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface ShiftDetail {
  date: string;
  grossCents: number;
  rentalCents: number;
  netCents: number;
  trips: number;
  hours: number;
}

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
  shiftDetails?: ShiftDetail[] | null;
  status: string;
}


const fmt = (cents: number) => `R ${(cents / 100).toFixed(2)}`;

// --- Payroll Sheet Import ---

interface PayrollRow {
  driverName: string;
  resolvedProfileId?: string;
  grossAmountCents: number;
  deductionsCents: number;
  incentivesCents: number;
  penaltiesCents: number;
  netAmountCents: number;
  tripCount: number;
  shiftDetails: ShiftDetail[];
}

interface DbDriverProfile {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  status?: string | null;
}

interface PayrollImportResult {
  imported: number;
  unmatched: string[];
  errors: { driverName: string; error: string }[];
}

function fuzzyMatchDriverId(csvName: string, profiles: DbDriverProfile[]): string {
  const norm = (s: string) => (s ?? "").toUpperCase().replace(/\s+/g, " ").trim();
  const n = norm(csvName);
  const m = profiles.find((p) => {
    const fn = norm(p.firstName ?? "");
    const ln = norm(p.lastName ?? "");
    return (
      `${fn} ${ln}`.trim() === n ||
      `${ln} ${fn}`.trim() === n ||
      (fn && fn === n) ||
      (ln && ln === n)
    );
  });
  return m?.id ?? "";
}

function parseCurrencyZAR(raw: string): number {
  if (!raw) return 0;
  let s = raw.replace(/["""R\s\t]/gi, "");
  if (!s || s === "-" || s === "–") return 0;
  const neg = s.startsWith("-");
  s = s.replace(/^-/, "");
  if (/,\d{2}$/.test(s)) {
    s = s.replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  const v = parseFloat(s);
  return isNaN(v) ? 0 : Math.round((neg ? -v : v) * 100);
}

function parseShortDate(raw: string): Date | null {
  const MONTHS: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const m = raw.trim().match(/^(\d{1,2})\s+([A-Za-z]{3})/i);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const mon = MONTHS[m[2].toLowerCase()];
  if (mon === undefined) return null;
  const year = new Date().getFullYear();
  const d = new Date(year, mon, day);
  if (d.getTime() - Date.now() > 180 * 24 * 60 * 60 * 1000) return new Date(year - 1, mon, day);
  return d;
}

async function readFileForNewPayroll(file: File): Promise<string[][]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: "array", FS: ";" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" }) as string[][];
}

function parseNewPayrollSheet(
  grid: string[][],
  dbDrivers: DbDriverProfile[]
): { rows: PayrollRow[]; periodStart: string; periodEnd: string } {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const rows: PayrollRow[] = [];
  let currentDriver: Omit<PayrollRow, "shiftDetails"> | null = null;
  let currentShifts: ShiftDetail[] = [];
  let globalPeriodStart = "";
  let globalPeriodEnd = "";

  const commitDriver = () => {
    if (currentDriver) {
      rows.push({ ...currentDriver, shiftDetails: currentShifts });
      currentDriver = null;
      currentShifts = [];
    }
  };

  for (const cols of grid) {
    const rowType = String(cols[0] ?? "").trim().toLowerCase();
    const driverName = String(cols[1] ?? "").trim();
    if (!rowType || !driverName) continue;

    if (rowType === "weekly total") {
      commitDriver();
      const ps = parseShortDate(String(cols[2] ?? ""));
      const pe = parseShortDate(String(cols[3] ?? ""));
      if (!globalPeriodStart && ps) globalPeriodStart = toISO(ps);
      if (!globalPeriodEnd && pe) globalPeriodEnd = toISO(pe);

      const gross = parseCurrencyZAR(String(cols[11] ?? ""));
      const rentalTotal = parseCurrencyZAR(String(cols[10] ?? ""));
      const netPay = parseCurrencyZAR(String(cols[12] ?? ""));
      const trips = Math.max(0, parseInt(String(cols[13] ?? "").replace(/[^0-9]/g, "") || "0", 10));
      const bonus = parseCurrencyZAR(String(cols[14] ?? ""));
      const netAfterBonus = parseCurrencyZAR(String(cols[15] ?? ""));
      const incentives = Math.max(0, bonus);
      const penalties = Math.max(0, -bonus);
      const finalNet = Math.max(0, netAfterBonus !== 0 ? netAfterBonus : netPay);

      currentDriver = {
        driverName,
        resolvedProfileId: fuzzyMatchDriverId(driverName, dbDrivers) || undefined,
        grossAmountCents: Math.max(0, gross),
        deductionsCents: Math.max(0, rentalTotal),
        incentivesCents: incentives,
        penaltiesCents: penalties,
        netAmountCents: finalNet,
        tripCount: trips,
      };
    } else if (rowType === "day") {
      if (currentDriver) {
        const gross = parseCurrencyZAR(String(cols[11] ?? ""));
        const rentalCents = parseCurrencyZAR(String(cols[10] ?? ""));
        const netCents = parseCurrencyZAR(String(cols[12] ?? ""));
        const trips = Math.max(0, parseInt(String(cols[13] ?? "").replace(/[^0-9]/g, "") || "0", 10));
        const hoursRaw = String(cols[9] ?? "").replace(",", ".").replace(/[^0-9.]/g, "");
        const hours = parseFloat(hoursRaw) || 0;
        const startLabel = String(cols[2] ?? "").trim();
        const endLabel = String(cols[3] ?? "").trim();
        const dateLabel = startLabel ? `${startLabel}–${endLabel}` : "";
        if (gross > 0 || trips > 0) {
          currentShifts.push({ date: dateLabel, grossCents: gross, rentalCents, netCents, trips, hours });
        }
      }
    }
  }

  commitDriver();
  return { rows, periodStart: globalPeriodStart, periodEnd: globalPeriodEnd };
}


function SpreadsheetImportDialog({ onClose }: { onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [parsedRows, setParsedRows] = useState<PayrollRow[]>([]);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [result, setResult] = useState<PayrollImportResult | null>(null);
  const { toast } = useToast();
  const { importPayrollSheet } = useAdminApi();

  const { data: driversRes } = useAdminListDrivers({ status: undefined });
  const dbDrivers = ((driversRes as { data?: DbDriverProfile[] } | undefined)?.data ?? []) as DbDriverProfile[];

  const handleFileSelect = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    try {
      const grid = await readFileForNewPayroll(file);
      const { rows, periodStart: ps, periodEnd: pe } = parseNewPayrollSheet(grid, dbDrivers);
      if (rows.length === 0) {
        toast({ title: "No driver rows detected", description: "Check the file has 'Weekly Total' rows with a Driver name.", variant: "destructive" });
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setParsedRows(rows);
      setPeriodStart(ps);
      setPeriodEnd(pe);
      setStep("preview");
    } catch (err) {
      toast({ title: "Failed to read file", description: (err as Error).message, variant: "destructive" });
    }
  };

  const matchedRows = parsedRows.filter((r) => !!r.resolvedProfileId);

  const handleImport = useCallback(async () => {
    if (!periodStart || !periodEnd) return;
    setStep("importing");
    try {
      const res = await importPayrollSheet(matchedRows, new Date(periodStart).toISOString(), new Date(periodEnd).toISOString());
      setResult((res as { data: PayrollImportResult }).data);
      setStep("done");
    } catch (err) {
      toast({ title: "Import failed", description: (err as Error).message, variant: "destructive" });
      setStep("preview");
    }
  }, [matchedRows, periodStart, periodEnd, importPayrollSheet, toast]);

  return (
    <div className="min-h-[380px] flex flex-col">
      {step === "upload" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8">
          <input type="file" accept=".csv,.xlsx,.xls" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-40 border-dashed border-2 border-gray-300 rounded-xl bg-gray-50 flex flex-col items-center justify-center gap-2 hover:bg-gray-100 hover:border-[#3DB324] transition-colors"
          >
            <FileSpreadsheet className="h-8 w-8 text-gray-400" />
            <span className="text-sm font-semibold text-gray-600">Click to upload weekly payroll spreadsheet</span>
            <span className="text-xs text-gray-400">Accepts .csv or .xlsx — semicolon-separated weekly payroll format</span>
          </button>
        </div>
      )}

      {step === "preview" && (
        <div className="flex-1 flex flex-col gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-[#3DB324]/10 border border-[#3DB324]/30 px-3 py-2 text-sm text-[#3DB324]">
            <Check className="h-4 w-4 shrink-0" />
            Period: <strong className="ml-1">{periodStart}</strong><span className="mx-1">→</span><strong>{periodEnd}</strong>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{parsedRows.length} driver{parsedRows.length !== 1 ? "s" : ""} in file</span>
            <span>
              <span className="text-[#3DB324] font-semibold">{matchedRows.length}</span> matched ·{" "}
              <span className="text-amber-600 font-semibold">{parsedRows.length - matchedRows.length}</span> unmatched
            </span>
          </div>
          <div className="overflow-auto rounded-lg border text-xs max-h-72 flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-6"></TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Rental</TableHead>
                  <TableHead className="text-right text-[#3DB324]">Net Pay</TableHead>
                  <TableHead className="text-right">Trips</TableHead>
                  <TableHead className="text-right">Shifts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedRows.map((row, i) => (
                  <TableRow key={i} className={!row.resolvedProfileId ? "opacity-50" : ""}>
                    <TableCell className="py-1.5 text-center">
                      {row.resolvedProfileId
                        ? <Check className="h-3.5 w-3.5 text-[#3DB324] inline" />
                        : <span className="text-amber-500 font-bold">!</span>}
                    </TableCell>
                    <TableCell className="font-medium py-1.5">{row.driverName}</TableCell>
                    <TableCell className="text-right py-1.5">{fmt(row.grossAmountCents)}</TableCell>
                    <TableCell className="text-right py-1.5 text-red-600">{fmt(row.deductionsCents)}</TableCell>
                    <TableCell className="text-right py-1.5 font-semibold text-[#3DB324]">{fmt(row.netAmountCents)}</TableCell>
                    <TableCell className="text-right py-1.5">{row.tripCount || "—"}</TableCell>
                    <TableCell className="text-right py-1.5">{row.shiftDetails.length || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {parsedRows.length - matchedRows.length > 0 && (
            <p className="text-xs text-amber-600">
              Drivers marked ! have no matching profile and will be skipped. Add them in the Drivers tab first.
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => { setStep("upload"); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
              Back
            </Button>
            <Button
              size="sm"
              className="ml-auto bg-[#3DB324] hover:bg-[#329b1d]"
              disabled={matchedRows.length === 0}
              onClick={handleImport}
            >
              Import {matchedRows.length} driver{matchedRows.length !== 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      )}

      {step === "importing" && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="h-10 w-10 border-4 border-[#3DB324] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-600 font-medium">Importing payroll data…</p>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-6">
          <Check className="h-12 w-12 text-[#3DB324]" />
          <div className="text-center">
            <p className="text-xl font-bold text-[#1C2126]">Import Complete</p>
            <p className="text-gray-500 mt-1">
              <span className="text-[#3DB324] font-semibold">{result.imported} driver{result.imported !== 1 ? "s" : ""}</span> imported as draft
              {result.unmatched.length > 0 && <>, <span className="text-amber-600 font-semibold">{result.unmatched.length} unmatched</span></>}
              {result.errors.length > 0 && <>, <span className="text-red-600 font-semibold">{result.errors.length} errors</span></>}.
            </p>
          </div>
          {result.errors.length > 0 && (
            <div className="w-full space-y-1">
              <p className="text-xs font-semibold text-red-700">Errors:</p>
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 max-h-24 overflow-y-auto">
                {result.errors.map((e, i) => <p key={i} className="text-xs text-red-700">{e.driverName}: {e.error}</p>)}
              </div>
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: earningsRes, isLoading } = useAdminListEarnings({ status: status !== "all" ? status : undefined });
  const earnings = (earningsRes?.data as EarningsItem[] | undefined) ?? [];

  const { data: driversListRes } = useAdminListDrivers({ status: undefined });
  const allDrivers = ((driversListRes as { data?: DbDriverProfile[] } | undefined)?.data ?? []) as DbDriverProfile[];
  const profileIdToName = Object.fromEntries(
    allDrivers.map((d) => [d.id, [d.firstName, d.lastName].filter(Boolean).join(" ") || d.id])
  );

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
    const data = { driverProfileId: newEarning.driverProfileId, periodStart: new Date(newEarning.periodStart).toISOString(), periodEnd: new Date(newEarning.periodEnd).toISOString(), grossAmountCents: gross, deductionsCents: deductions, incentivesCents: incentives, penaltiesCents: penalties, netAmountCents: gross - deductions - penalties + incentives } as EarningsInput;
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
              <Button variant="outline" data-testid="btn-import-csv"><FileSpreadsheet className="mr-2 h-4 w-4" /> Import Payout Sheet</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Import Weekly Payout Sheet</DialogTitle></DialogHeader>
              <SpreadsheetImportDialog onClose={() => { setCsvOpen(false); invalidate(); }} />
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
                earnings.flatMap((e) => {
                  const driverName = profileIdToName[e.driverProfileId] || e.driverProfileId.slice(0, 10) + "…";
                  const shifts = e.shiftDetails ?? [];
                  const isExpanded = expandedId === e.id;
                  return [
                    <TableRow
                      key={e.id}
                      className={`cursor-pointer hover:bg-gray-50 ${isExpanded ? "bg-gray-50" : ""}`}
                      onClick={() => setExpandedId(isExpanded ? null : e.id)}
                    >
                      <TableCell className="font-medium text-sm">
                        <div className="flex items-center gap-1.5">
                          {shifts.length > 0
                            ? (isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />)
                            : <span className="w-3.5 inline-block" />
                          }
                          {driverName}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{format(new Date(e.periodStart), "MMM d")} – {format(new Date(e.periodEnd), "MMM d, yyyy")}</TableCell>
                      <TableCell className="text-right">{fmt(e.grossAmountCents ?? 0)}</TableCell>
                      <TableCell className="text-right text-red-600">-{fmt((e.deductionsCents ?? 0) + (e.penaltiesCents ?? 0))}</TableCell>
                      <TableCell className="text-right font-bold text-[#3DB324]">{fmt(e.netAmountCents ?? 0)}</TableCell>
                      <TableCell className="text-center">{e.tripCount ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={e.status === "published" ? "default" : "secondary"} className={e.status === "published" ? "bg-[#3DB324] hover:bg-[#3DB324]" : ""}>{e.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right" onClick={(ev) => ev.stopPropagation()}>
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
                        </div>
                      </TableCell>
                    </TableRow>,
                    isExpanded && shifts.length > 0 ? (
                      <TableRow key={`${e.id}-detail`} className="bg-gray-50/80">
                        <TableCell colSpan={8} className="py-0 px-0">
                          <div className="ml-10 border-l-2 border-[#3DB324]/30 pl-4 py-3">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-400 uppercase tracking-wide">
                                  <th className="text-left pb-1.5 font-medium">Shift Date</th>
                                  <th className="text-right pb-1.5 font-medium">Hours</th>
                                  <th className="text-right pb-1.5 font-medium">Gross</th>
                                  <th className="text-right pb-1.5 font-medium">Rental</th>
                                  <th className="text-right pb-1.5 font-medium text-[#3DB324]">Net</th>
                                  <th className="text-right pb-1.5 font-medium">Trips</th>
                                </tr>
                              </thead>
                              <tbody>
                                {shifts.map((s, i) => (
                                  <tr key={i} className="border-t border-gray-100">
                                    <td className="py-1 text-gray-700 font-medium">{s.date}</td>
                                    <td className="py-1 text-right text-gray-600">{s.hours > 0 ? s.hours.toFixed(2) : "—"}</td>
                                    <td className="py-1 text-right text-gray-700">{fmt(s.grossCents)}</td>
                                    <td className="py-1 text-right text-red-500">-{fmt(s.rentalCents)}</td>
                                    <td className="py-1 text-right font-semibold text-[#3DB324]">{fmt(s.netCents)}</td>
                                    <td className="py-1 text-right text-gray-600">{s.trips || "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null,
                  ].filter(Boolean);
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
