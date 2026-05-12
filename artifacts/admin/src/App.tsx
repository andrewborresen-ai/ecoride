import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser, useAuth } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { useEffect, useRef } from 'react';
import { useGetMe, getGetMeQueryKey, setAuthTokenGetter } from "@workspace/api-client-react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Layout } from "@/components/Layout";
import DashboardPage from "@/pages/DashboardPage";
import DriversPage from "@/pages/DriversPage";
import DriverDetailPage from "@/pages/DriverDetailPage";
import VehiclesPage from "@/pages/VehiclesPage";
import ShiftsPage from "@/pages/ShiftsPage";
import ShiftDetailPage from "@/pages/ShiftDetailPage";
import AgreementsPage from "@/pages/AgreementsPage";
import FleetAccessPage from "@/pages/FleetAccessPage";
import EarningsPage from "@/pages/EarningsPage";
import NotificationsPage from "@/pages/NotificationsPage";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/icon.png`,
  },
  variables: {
    colorPrimary: "#3DB324",
    colorForeground: "#1C2126",
    colorMutedForeground: "#6b7280",
    colorDanger: "#EF4444",
    colorBackground: "#ffffff",
    colorInput: "#ffffff",
    colorInputForeground: "#1C2126",
    colorNeutral: "#E2E8DF",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    fontWeightBold: "700",
    fontWeightMedium: "600",
    fontWeightNormal: "400",
    borderRadius: "0.75rem",
    spacingUnit: "1rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl border border-[#E2E8DF]",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none px-2",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[#1C2126] font-bold text-xl",
    headerSubtitle: "text-[#6b7280] font-normal",
    logoBox: "flex justify-center mb-1",
    logoImage: "h-12 w-12",
    formFieldLabel: "text-[#1C2126] font-semibold text-sm mb-1",
    formFieldInput: [
      "h-11 rounded-xl border-[1.5px] border-[#E2E8DF] bg-white text-[#1C2126]",
      "text-sm font-medium px-4",
      "focus:border-[#3DB324] focus:ring-2 focus:ring-[#3DB324]/20",
      "placeholder:text-[#6b7280] placeholder:font-normal",
    ].join(" "),
    formButtonPrimary: [
      "h-11 rounded-xl bg-[#3DB324] hover:bg-[#329b1d] text-white font-semibold text-sm",
      "border-0 shadow-sm active:scale-[0.98] transition-all",
    ].join(" "),
    socialButtonsBlockButton: [
      "h-11 rounded-xl border-[1.5px] border-[#E2E8DF] bg-white text-[#1C2126]",
      "font-semibold text-sm hover:bg-[#F5F7F5] hover:border-[#3DB324]/40",
      "shadow-none transition-all",
    ].join(" "),
    socialButtonsBlockButtonText: "text-[#1C2126] font-semibold",
    footerActionLink: "text-[#3DB324] font-semibold hover:text-[#329b1d]",
    footerActionText: "text-[#6b7280]",
    footerAction: "bg-[#F5F7F5] rounded-xl border border-[#E2E8DF]",
    developmentUsageBadge: "!hidden",
    dividerText: "text-[#6b7280] text-sm",
    dividerLine: "bg-[#E2E8DF]",
    identityPreviewEditButton: "text-[#3DB324] font-semibold",
    formFieldSuccessText: "text-[#3DB324]",
    alertText: "text-red-600",
    alert: "border-red-100 bg-red-50 rounded-xl",
    otpCodeFieldInput: [
      "h-12 w-12 rounded-xl border-[1.5px] border-[#E2E8DF] text-[#1C2126] font-bold text-lg",
      "focus:border-[#3DB324]",
    ].join(" "),
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);
  return null;
}

function ClerkTokenBridge() {
  const { getToken } = useAuth();
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    return () => {
      setAuthTokenGetter(null);
    };
  }, [getToken]);
  return null;
}

function EcoRideLogo() {
  return (
    <div className="flex flex-col items-center mb-8">
      {/* Green rounded square with white lightning bolt — matches mobile logoMark exactly */}
      <div
        className="flex items-center justify-center mb-3"
        style={{
          width: 64, height: 64,
          backgroundColor: "#3DB324",
          borderRadius: 16,
        }}
      >
        {/* White zap / lightning bolt SVG matching Feather "zap" size 28 */}
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      </div>
      {/* ECORIDE — Inter 700, #3DB324, letterSpacing 4 */}
      <p style={{ fontSize: 22, fontWeight: 700, color: "#3DB324", letterSpacing: 4, fontFamily: "Inter, sans-serif", lineHeight: 1 }}>
        ECORIDE
      </p>
      {/* RIDE SMARTER — Inter 500, #6B7280, letterSpacing 3 */}
      <p style={{ fontSize: 11, fontWeight: 500, color: "#6B7280", letterSpacing: 3, fontFamily: "Inter, sans-serif", marginTop: 3, lineHeight: 1 }}>
        RIDE SMARTER
      </p>
    </div>
  );
}

function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8">
      <div
        className="w-[380px] max-w-full rounded-[20px] bg-white pt-8"
        style={{ boxShadow: "0 4px 24px rgba(28,33,38,0.10)", border: "1px solid #E2E8DF" }}
      >
        <EcoRideLogo />
        {children}
      </div>
    </div>
  );
}

function SignInPage() {
  return (
    <AuthCard>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </AuthCard>
  );
}

function SignUpPage() {
  return (
    <AuthCard>
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </AuthCard>
  );
}

interface MeData {
  user?: {
    role?: string;
    id?: string;
  };
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useUser();
  const { data: me, isLoading } = useGetMe({ query: { enabled: !!isSignedIn, queryKey: getGetMeQueryKey() } });

  if (!isLoaded || isLoading) {
    return <div className="flex min-h-[100dvh] items-center justify-center text-gray-500">Loading…</div>;
  }

  if (!isSignedIn) {
    return <Redirect to="/sign-in" />;
  }

  const userData = me?.data as MeData | undefined;
  const role = userData?.user?.role;

  if (role !== "admin" && role !== "superadmin") {
    return <Redirect to="/sign-in" />;
  }

  return <>{children}</>;
}

function PageBoundary({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

function ProtectedRoutes() {
  return (
    <AdminGuard>
      <Layout>
        <PageBoundary>
          <Switch>
            <Route path="/dashboard" component={DashboardPage} />
            <Route path="/drivers" component={DriversPage} />
            <Route path="/drivers/:id" component={DriverDetailPage} />
            <Route path="/vehicles" component={VehiclesPage} />
            <Route path="/agreements" component={AgreementsPage} />
            <Route path="/shifts" component={ShiftsPage} />
            <Route path="/shifts/:id" component={ShiftDetailPage} />
            <Route path="/fleet-access" component={FleetAccessPage} />
            <Route path="/earnings" component={EarningsPage} />
            <Route path="/notifications" component={NotificationsPage} />
            <Route path="/settings" component={SettingsPage} />
            <Route component={NotFound} />
          </Switch>
        </PageBoundary>
      </Layout>
    </AdminGuard>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey || ""}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <ClerkTokenBridge />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/*" component={ProtectedRoutes} />
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  if (!clerkPubKey) {
    return <div>Missing VITE_CLERK_PUBLISHABLE_KEY</div>;
  }

  return (
    <WouterRouter base={basePath}>
      <TooltipProvider>
        <ClerkProviderWithRoutes />
        <Toaster />
      </TooltipProvider>
    </WouterRouter>
  );
}

export default App;
