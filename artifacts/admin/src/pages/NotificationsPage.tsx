import { useState } from "react";
import { useAdminSendNotification } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function NotificationsPage() {
  const { toast } = useToast();
  const sendNotification = useAdminSendNotification();

  const [form, setForm] = useState({
    userId: "",
    title: "",
    body: "",
    type: "system"
  });

  const handleSend = () => {
    if (!form.userId || !form.title || !form.body) {
      toast({ title: "Please fill all required fields", variant: "destructive" }); return;
    }

    sendNotification.mutate({ data: form }, {
      onSuccess: () => {
        toast({ title: "Notification sent successfully" });
        setForm({ ...form, title: "", body: "" });
      },
      onError: (err: any) => {
        toast({ title: "Failed to send notification", description: err.message, variant: "destructive" });
      }
    });
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
            <label className="text-sm font-medium">Recipient (User ID)</label>
            <Input 
              placeholder="e.g. user_2XyZ..." 
              value={form.userId} 
              onChange={e => setForm({...form, userId: e.target.value})} 
            />
            <p className="text-xs text-gray-400">Enter a specific Clerk user ID, or 'all' (if supported by backend)</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Message Type</label>
            <Select value={form.type} onValueChange={v => setForm({...form, type: v})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
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
              onChange={e => setForm({...form, title: e.target.value})} 
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Message Body</label>
            <Textarea 
              placeholder="Type your message here..." 
              className="h-32"
              value={form.body} 
              onChange={e => setForm({...form, body: e.target.value})} 
            />
          </div>

          <Button 
            className="w-full bg-[#3DB324] hover:bg-[#329b1d]" 
            onClick={handleSend}
            disabled={sendNotification.isPending}
          >
            <Send className="mr-2 h-4 w-4" /> Send Notification
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
