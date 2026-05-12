import { useState, useEffect, useCallback } from "react";
import {
  useAdminSendNotification,
  useAdminListDrivers,
} from "@workspace/api-client-react";
import type { SendNotificationInput } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Send, Users, MessageSquare, AlertCircle, Search, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useAdminApi } from "@/lib/adminApi";
import { Skeleton } from "@/components/ui/skeleton";

interface DriverItem {
  id: string;
  firstName?: string;
  lastName?: string;
  userId?: string;
  fleetType?: string;
  status?: string;
}

interface DriversData {
  items: DriverItem[];
}

interface SentNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  createdAt: string;
  sentBy?: string;
}

type RecipientMode = "specific" | "selected" | "all_electric" | "all_lpg" | "all_approved";

function DriverSelectDialog({
  drivers,
  selected,
  onConfirm,
}: {
  drivers: DriverItem[];
  selected: Set<string>;
  onConfirm: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [localSelected, setLocalSelected] = useState<Set<string>>(new Set(selected));

  const filtered = drivers.filter((d) => {
    const name = `${d.firstName ?? ""} ${d.lastName ?? ""}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const toggle = (id: string) => {
    setLocalSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setLocalSelected(new Set(selected)); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="mt-2">
          <Users className="mr-2 h-4 w-4" /> Choose drivers ({selected.size} selected)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Select Drivers</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input placeholder="Search by name..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1 rounded-lg border p-2">
            {filtered.length === 0 ? (
              <p className="text-center text-gray-500 text-sm py-4">No drivers found.</p>
            ) : filtered.map((d) => (
              <label key={d.id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer">
                <Checkbox checked={localSelected.has(d.id)} onCheckedChange={() => toggle(d.id)} />
                <span className="text-sm font-medium">{d.firstName} {d.lastName}</span>
                <span className="text-xs text-gray-400 ml-auto capitalize">{d.fleetType}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-500">{localSelected.size} driver{localSelected.size !== 1 ? "s" : ""} selected</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button className="bg-[#3DB324] hover:bg-[#329b1d]" onClick={() => { onConfirm(localSelected); setOpen(false); }}>
            Confirm Selection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function NotificationsPage() {
  const { toast } = useToast();
  const sendNotification = useAdminSendNotification();
  const { getSentNotifications } = useAdminApi();

  const { data: driversRes } = useAdminListDrivers({ status: "approved", limit: 500 });
  const allApprovedDrivers = (driversRes?.data as DriversData | undefined)?.items ?? [];
  const electricDrivers = allApprovedDrivers.filter((d) => d.fleetType === "electric");
  const lpgDrivers = allApprovedDrivers.filter((d) => d.fleetType === "lpg");

  const [recipientMode, setRecipientMode] = useState<RecipientMode>("specific");
  const [specificUserId, setSpecificUserId] = useState("");
  const [selectedDriverIds, setSelectedDriverIds] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ title: "", body: "", type: "system" });
  const [scheduledFor, setScheduledFor] = useState("");
  const [sending, setSending] = useState(false);
  const [sentHistory, setSentHistory] = useState<SentNotification[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await getSentNotifications();
      setSentHistory((res?.data as SentNotification[] | undefined) ?? []);
    } catch {
      // silently ignore
    } finally {
      setLoadingHistory(false);
    }
  }, [getSentNotifications]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const getTargetDrivers = (): DriverItem[] => {
    switch (recipientMode) {
      case "specific":
        return specificUserId.trim() ? [{ id: "manual", userId: specificUserId.trim() }] : [];
      case "selected": {
        const byId: Record<string, DriverItem> = Object.fromEntries(allApprovedDrivers.map((d) => [d.id, d]));
        return Array.from(selectedDriverIds).map((id) => byId[id]).filter(Boolean) as DriverItem[];
      }
      case "all_electric": return electricDrivers.filter((d) => d.userId);
      case "all_lpg": return lpgDrivers.filter((d) => d.userId);
      case "all_approved": return allApprovedDrivers.filter((d) => d.userId);
    }
  };

  const recipientCount = getTargetDrivers().length;

  const getRecipientLabel = (mode: RecipientMode) => {
    switch (mode) {
      case "specific": return "Specific driver";
      case "selected": return `Selected drivers (${selectedDriverIds.size})`;
      case "all_electric": return `All Electric (${electricDrivers.length})`;
      case "all_lpg": return `All LPG (${lpgDrivers.length})`;
      case "all_approved": return `All approved (${allApprovedDrivers.length})`;
    }
  };

  const doSend = async () => {
    const targets = getTargetDrivers();
    if (targets.length === 0) {
      toast({ title: "No recipients selected", variant: "destructive" }); return;
    }
    if (!form.title || !form.body) {
      toast({ title: "Title and message required", variant: "destructive" }); return;
    }

    setSending(true);
    let success = 0; let fail = 0;

    for (const driver of targets) {
      const userId = driver.userId ?? driver.id;
      const data: SendNotificationInput = { userId, title: form.title, body: form.body, type: form.type };
      await new Promise<void>((resolve) => {
        sendNotification.mutate({ data }, {
          onSuccess: () => { success++; resolve(); },
          onError: () => { fail++; resolve(); },
        });
      });
    }

    setSending(false);
    if (fail > 0) {
      toast({ title: `Sent ${success}, failed ${fail}`, variant: "destructive" });
    } else {
      toast({ title: `Notification sent to ${success} recipient${success !== 1 ? "s" : ""}` });
      setForm({ title: "", body: "", type: "system" });
    }
    await loadHistory();
  };

  const handleSend = async () => {
    if (!form.title || !form.body) { toast({ title: "Title and body required", variant: "destructive" }); return; }
    const targets = getTargetDrivers();
    if (targets.length === 0) { toast({ title: "No recipients selected", variant: "destructive" }); return; }

    if (scheduledFor) {
      const sendAt = new Date(scheduledFor);
      const delay = sendAt.getTime() - Date.now();
      if (delay > 0) {
        toast({ title: `Scheduled for ${format(sendAt, "MMM d, HH:mm")}`, description: "Will send while this page is open." });
        setTimeout(() => { void doSend(); }, delay);
        return;
      }
    }
    await doSend();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[#1C2126] tracking-tight">Notifications</h1>
        <p className="text-gray-500">Send in-app alerts and updates to drivers.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5" /> Compose Message</CardTitle>
          <CardDescription>Messages appear immediately in drivers' in-app inbox.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Recipients</Label>
            <Select value={recipientMode} onValueChange={(v) => setRecipientMode(v as RecipientMode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="specific">Specific driver (by User ID)</SelectItem>
                <SelectItem value="selected">Selected drivers (multi-select)</SelectItem>
                <SelectItem value="all_electric">All approved Electric / EcoRide drivers — {electricDrivers.length}</SelectItem>
                <SelectItem value="all_lpg">All approved LPG / Khula Rides drivers — {lpgDrivers.length}</SelectItem>
                <SelectItem value="all_approved">All approved drivers — {allApprovedDrivers.length}</SelectItem>
              </SelectContent>
            </Select>

            {recipientMode === "specific" && (
              <Input
                placeholder="e.g. user_2XyZ..."
                value={specificUserId}
                onChange={(e) => setSpecificUserId(e.target.value)}
                className="font-mono mt-2"
              />
            )}

            {recipientMode === "selected" && (
              <DriverSelectDialog
                drivers={allApprovedDrivers}
                selected={selectedDriverIds}
                onConfirm={setSelectedDriverIds}
              />
            )}
          </div>

          {recipientCount > 0 && recipientMode !== "specific" && (
            <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
              <Users className="h-4 w-4 text-blue-600 shrink-0" />
              <p className="text-sm text-blue-800">
                <strong>{recipientCount}</strong> {getRecipientLabel(recipientMode)} will receive this notification.
              </p>
            </div>
          )}

          {recipientMode !== "specific" && recipientCount === 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
              <AlertCircle className="h-4 w-4 text-orange-600 shrink-0" />
              <p className="text-sm text-orange-800">No recipients in this group yet.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Message Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">System Alert</SelectItem>
                  <SelectItem value="shift">Shift Update</SelectItem>
                  <SelectItem value="payment">Payment Info</SelectItem>
                  <SelectItem value="document">Document Request</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Schedule Send (optional)</Label>
              <Input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} />
              {scheduledFor && <p className="text-xs text-gray-400">Will send at {format(new Date(scheduledFor), "MMM d, HH:mm")} while this tab is open.</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input placeholder="Notification subject line" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={100} />
            <p className="text-xs text-gray-400 text-right">{form.title.length}/100</p>
          </div>

          <div className="space-y-1.5">
            <Label>Message Body</Label>
            <Textarea placeholder="Write your message here..." className="h-28" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} maxLength={500} />
            <p className="text-xs text-gray-400 text-right">{form.body.length}/500</p>
          </div>

          <Button
            className="w-full bg-[#3DB324] hover:bg-[#329b1d]"
            onClick={handleSend}
            disabled={sending || sendNotification.isPending}
            data-testid="btn-send-notification"
          >
            <Send className="mr-2 h-4 w-4" />
            {sending ? "Sending…" : scheduledFor && new Date(scheduledFor) > new Date()
              ? `Schedule for ${format(new Date(scheduledFor), "HH:mm")}`
              : `Send to ${recipientCount > 0 ? recipientCount : "—"} recipient${recipientCount !== 1 ? "s" : ""}`}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Sent History</CardTitle>
          <CardDescription>All admin-sent notifications, stored on the server.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loadingHistory ? (
            <div className="p-4 space-y-2">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : sentHistory.length === 0 ? (
            <p className="text-center text-gray-500 py-8 text-sm">No notifications sent yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sent At</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Recipient ID</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sentHistory.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="text-sm tabular-nums text-gray-500">
                      {format(new Date(n.createdAt), "MMM d HH:mm")}
                    </TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">{n.title}</TableCell>
                    <TableCell className="font-mono text-xs text-gray-500">{n.userId.slice(0, 12)}…</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{n.type}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
