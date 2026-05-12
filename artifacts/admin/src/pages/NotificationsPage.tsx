import { useState } from "react";
import {
  useAdminSendNotification,
  useAdminListDrivers,
} from "@workspace/api-client-react";
import type { SendNotificationInput } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Send, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DriverItem {
  id: string;
  firstName?: string;
  lastName?: string;
  userId?: string;
}

interface DriversData {
  items: DriverItem[];
}

type RecipientMode = "specific" | "all_electric" | "all_lpg";

export default function NotificationsPage() {
  const { toast } = useToast();
  const sendNotification = useAdminSendNotification();
  const { data: driversRes } = useAdminListDrivers({ status: "approved", limit: 100 });
  const drivers = (driversRes?.data as DriversData | undefined)?.items ?? [];

  const [recipientMode, setRecipientMode] = useState<RecipientMode>("specific");
  const [specificUserId, setSpecificUserId] = useState("");
  const [form, setForm] = useState({
    title: "",
    body: "",
    type: "system",
  });
  const [sentCount, setSentCount] = useState(0);

  const getTargetUserIds = (): string[] => {
    if (recipientMode === "specific") {
      return specificUserId.trim() ? [specificUserId.trim()] : [];
    }
    return drivers
      .filter((d) => d.userId)
      .map((d) => d.userId as string);
  };

  const handleSend = async () => {
    if (!form.title || !form.body) {
      toast({ title: "Title and message body are required", variant: "destructive" }); return;
    }
    const targets = getTargetUserIds();
    if (targets.length === 0) {
      toast({ title: "No recipients selected", variant: "destructive" }); return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const userId of targets) {
      const data: SendNotificationInput = {
        userId,
        title: form.title,
        body: form.body,
        type: form.type,
      };
      await new Promise<void>((resolve) => {
        sendNotification.mutate({ data }, {
          onSuccess: () => { successCount++; resolve(); },
          onError: () => { errorCount++; resolve(); },
        });
      });
    }

    setSentCount((c) => c + successCount);
    if (errorCount > 0) {
      toast({ title: `Sent ${successCount}, failed ${errorCount}`, variant: "destructive" });
    } else {
      toast({ title: `Notification sent to ${successCount} recipient${successCount !== 1 ? 's' : ''}` });
      setForm({ title: "", body: "", type: "system" });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[#1C2126] tracking-tight">Notifications</h1>
        <p className="text-gray-500">Send alerts and updates to drivers.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Send New Message</CardTitle>
          <CardDescription>Messages will appear in the driver's mobile app inbox.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Recipients</label>
            <Select value={recipientMode} onValueChange={(v) => setRecipientMode(v as RecipientMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="specific">Specific driver (by User ID)</SelectItem>
                <SelectItem value="all_electric">All approved Electric drivers</SelectItem>
                <SelectItem value="all_lpg">All approved LPG drivers</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {recipientMode === "specific" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">User ID</label>
              <Input
                placeholder="e.g. user_2XyZ..."
                value={specificUserId}
                onChange={(e) => setSpecificUserId(e.target.value)}
              />
            </div>
          )}

          {recipientMode !== "specific" && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Users className="h-4 w-4 text-blue-500 shrink-0" />
              <p className="text-sm text-blue-700">
                {drivers.length} approved driver{drivers.length !== 1 ? 's' : ''} will receive this notification.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Message Type</label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System Alert</SelectItem>
                <SelectItem value="shift">Shift Update</SelectItem>
                <SelectItem value="payment">Payment Info</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <Input
              placeholder="Message subject"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Message Body</label>
            <Textarea
              placeholder="Type your message here..."
              className="h-32"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </div>

          <Button
            className="w-full bg-[#3DB324] hover:bg-[#329b1d]"
            onClick={handleSend}
            disabled={sendNotification.isPending}
            data-testid="btn-send-notification"
          >
            <Send className="mr-2 h-4 w-4" /> Send Notification
          </Button>

          {sentCount > 0 && (
            <p className="text-center text-sm text-gray-500">
              {sentCount} notification{sentCount !== 1 ? 's' : ''} sent this session.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {['system', 'shift', 'payment'].map((t) => (
              <Badge key={t} variant="outline" className="capitalize">{t}</Badge>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Notification history is viewable per-driver on the driver detail page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
