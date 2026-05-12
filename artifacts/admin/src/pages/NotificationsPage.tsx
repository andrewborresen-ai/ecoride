import { useState } from "react";
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
import { Send, Users, MessageSquare, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

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

type RecipientMode = "specific" | "all_electric" | "all_lpg" | "all_approved";

interface SentRecord {
  title: string;
  body: string;
  type: string;
  recipientMode: RecipientMode;
  recipientCount: number;
  sentAt: Date;
  failCount: number;
}

export default function NotificationsPage() {
  const { toast } = useToast();
  const sendNotification = useAdminSendNotification();

  const { data: driversRes } = useAdminListDrivers({ status: "approved", limit: 500 });
  const allApprovedDrivers = (driversRes?.data as DriversData | undefined)?.items ?? [];

  const electricDrivers = allApprovedDrivers.filter((d) => d.fleetType === "electric");
  const lpgDrivers = allApprovedDrivers.filter((d) => d.fleetType === "lpg");

  const [recipientMode, setRecipientMode] = useState<RecipientMode>("specific");
  const [specificUserId, setSpecificUserId] = useState("");
  const [form, setForm] = useState({ title: "", body: "", type: "system" });
  const [sending, setSending] = useState(false);
  const [sentHistory, setSentHistory] = useState<SentRecord[]>([]);

  const getTargetDrivers = (): DriverItem[] => {
    switch (recipientMode) {
      case "specific":
        return specificUserId.trim()
          ? [{ id: "manual", userId: specificUserId.trim() }]
          : [];
      case "all_electric":
        return electricDrivers.filter((d) => d.userId);
      case "all_lpg":
        return lpgDrivers.filter((d) => d.userId);
      case "all_approved":
        return allApprovedDrivers.filter((d) => d.userId);
    }
  };

  const recipientCount = getTargetDrivers().length;

  const getRecipientLabel = (mode: RecipientMode): string => {
    switch (mode) {
      case "specific": return "Specific driver";
      case "all_electric": return `All electric drivers (${electricDrivers.length})`;
      case "all_lpg": return `All LPG drivers (${lpgDrivers.length})`;
      case "all_approved": return `All approved drivers (${allApprovedDrivers.length})`;
    }
  };

  const handleSend = async () => {
    if (!form.title || !form.body) {
      toast({ title: "Title and message body are required", variant: "destructive" }); return;
    }
    const targets = getTargetDrivers();
    if (targets.length === 0) {
      toast({ title: "No recipients — check the recipient selection", variant: "destructive" }); return;
    }

    setSending(true);
    let success = 0;
    let fail = 0;

    for (const driver of targets) {
      const userId = driver.userId ?? driver.id;
      const data: SendNotificationInput = {
        userId,
        title: form.title,
        body: form.body,
        type: form.type,
      };
      await new Promise<void>((resolve) => {
        sendNotification.mutate({ data }, {
          onSuccess: () => { success++; resolve(); },
          onError: () => { fail++; resolve(); },
        });
      });
    }

    setSentHistory((prev) => [{
      title: form.title,
      body: form.body,
      type: form.type,
      recipientMode,
      recipientCount: success,
      failCount: fail,
      sentAt: new Date(),
    }, ...prev]);

    setSending(false);
    if (fail > 0) {
      toast({ title: `Sent to ${success}, failed ${fail}`, variant: "destructive" });
    } else {
      toast({ title: `Notification sent to ${success} recipient${success !== 1 ? "s" : ""}` });
      setForm({ title: "", body: "", type: "system" });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[#1C2126] tracking-tight">Notifications</h1>
        <p className="text-gray-500">Send alerts and updates to drivers via in-app messaging.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" /> Compose Message
          </CardTitle>
          <CardDescription>Messages appear in the driver's mobile app inbox immediately.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Recipients</Label>
            <Select value={recipientMode} onValueChange={(v) => setRecipientMode(v as RecipientMode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="specific">Specific driver (by User ID)</SelectItem>
                <SelectItem value="all_electric">All approved Electric (EcoRide) drivers — {electricDrivers.length}</SelectItem>
                <SelectItem value="all_lpg">All approved LPG (Khula Rides) drivers — {lpgDrivers.length}</SelectItem>
                <SelectItem value="all_approved">All approved drivers — {allApprovedDrivers.length}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {recipientMode === "specific" && (
            <div className="space-y-1.5">
              <Label>User ID</Label>
              <Input
                placeholder="e.g. user_2XyZ..."
                value={specificUserId}
                onChange={(e) => setSpecificUserId(e.target.value)}
                className="font-mono"
              />
            </div>
          )}

          {recipientMode !== "specific" && recipientCount > 0 && (
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
              <p className="text-sm text-orange-800">No approved drivers in this group yet.</p>
            </div>
          )}

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
            <Label>Title</Label>
            <Input
              placeholder="Notification subject line"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              maxLength={100}
            />
            <p className="text-xs text-gray-400 text-right">{form.title.length}/100</p>
          </div>

          <div className="space-y-1.5">
            <Label>Message Body</Label>
            <Textarea
              placeholder="Write your message here..."
              className="h-28"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              maxLength={500}
            />
            <p className="text-xs text-gray-400 text-right">{form.body.length}/500</p>
          </div>

          <Button
            className="w-full bg-[#3DB324] hover:bg-[#329b1d]"
            onClick={handleSend}
            disabled={sending || sendNotification.isPending}
            data-testid="btn-send-notification"
          >
            <Send className="mr-2 h-4 w-4" />
            {sending ? "Sending…" : `Send to ${recipientCount > 0 ? recipientCount : "—"} recipient${recipientCount !== 1 ? "s" : ""}`}
          </Button>
        </CardContent>
      </Card>

      {sentHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" /> Sent This Session
            </CardTitle>
            <CardDescription>Notifications dispatched since the page was opened.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sent At</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sentHistory.map((record, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm tabular-nums text-gray-500">
                      {format(record.sentAt, "HH:mm:ss")}
                    </TableCell>
                    <TableCell className="font-medium max-w-[180px] truncate">{record.title}</TableCell>
                    <TableCell className="text-sm capitalize">{getRecipientLabel(record.recipientMode)}</TableCell>
                    <TableCell className="text-center font-mono">{record.recipientCount}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{record.type}</Badge>
                    </TableCell>
                    <TableCell>
                      {record.failCount > 0 ? (
                        <Badge variant="destructive">{record.failCount} failed</Badge>
                      ) : (
                        <Badge className="bg-[#3DB324] hover:bg-[#3DB324]">Delivered</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
