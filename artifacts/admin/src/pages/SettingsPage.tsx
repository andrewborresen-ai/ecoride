import { useUser, useClerk } from "@clerk/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { LogOut, User, Shield } from "lucide-react";

export default function SettingsPage() {
  const { user } = useUser();
  const { signOut } = useClerk();

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[#1C2126] tracking-tight">Settings</h1>
        <p className="text-gray-500">Manage your account and platform preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Account
          </CardTitle>
          <CardDescription>Your Clerk identity and session information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Name</p>
              <p className="font-medium">
                {user?.firstName || user?.lastName
                  ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Email</p>
              <p className="font-medium">{user?.primaryEmailAddress?.emailAddress ?? "—"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">User ID</p>
              <p className="font-mono text-xs text-gray-600 break-all">{user?.id ?? "—"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Role</p>
              <Badge className="bg-[#3DB324] hover:bg-[#329b1d] mt-1">
                {(user?.publicMetadata as { role?: string })?.role ?? "admin"}
              </Badge>
            </div>
          </div>

          <Separator />

          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-gray-400" />
            <p className="text-sm text-gray-500">
              This portal is restricted to authorised EcoRide administrators only.
            </p>
          </div>

          <Button
            variant="destructive"
            className="w-full"
            onClick={() => signOut()}
            data-testid="btn-sign-out"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Platform</CardTitle>
          <CardDescription>EcoRide Fleet Platform information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Platform</p>
              <p className="font-medium">EcoRide Fleet Platform</p>
            </div>
            <div>
              <p className="text-gray-500">Environment</p>
              <Badge variant="secondary">{import.meta.env.MODE}</Badge>
            </div>
            <div>
              <p className="text-gray-500">Fleets</p>
              <p className="font-medium">EcoRide (Electric) · Khula Rides (LPG)</p>
            </div>
            <div>
              <p className="text-gray-500">API</p>
              <p className="font-medium font-mono text-xs text-gray-600">/api/v1</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
