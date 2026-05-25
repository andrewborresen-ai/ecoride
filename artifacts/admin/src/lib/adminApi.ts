import { useAuth } from "@clerk/react";
import { useCallback } from "react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export function useAdminApi() {
  const { getToken } = useAuth();

  const authFetch = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const token = await getToken();
      const headers = new Headers(options.headers);
      headers.set("Content-Type", "application/json");
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }
      return res.json();
    },
    [getToken]
  );

  const getDriverNotes = useCallback(
    (driverId: string) => authFetch(`/api/v1/admin/drivers/${driverId}/notes`),
    [authFetch]
  );

  const patchDriverNotes = useCallback(
    (driverId: string, notes: string) =>
      authFetch(`/api/v1/admin/drivers/${driverId}/notes`, {
        method: "PATCH",
        body: JSON.stringify({ notes }),
      }),
    [authFetch]
  );

  const getSentNotifications = useCallback(
    () => authFetch(`/api/v1/admin/notifications/sent`),
    [authFetch]
  );

  const waitlistAllocation = useCallback(
    (shiftId: string, allocationId: string) =>
      authFetch(`/api/v1/admin/shifts/${shiftId}/allocations/${allocationId}/waitlist`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    [authFetch]
  );

  const unpublishEarnings = useCallback(
    (earningsId: string) =>
      authFetch(`/api/v1/admin/earnings/${earningsId}/unpublish`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    [authFetch]
  );

  const retryTelematics = useCallback(
    (driverId: string) =>
      authFetch(`/api/v1/admin/drivers/${driverId}/retry-telematics`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    [authFetch]
  );

  const importPayrollSheet = useCallback(
    (rows: unknown[], periodStart: string, periodEnd: string) =>
      authFetch("/api/v1/admin/earnings/import-payroll-sheet", {
        method: "POST",
        body: JSON.stringify({ rows, periodStart, periodEnd }),
      }),
    [authFetch]
  );

  return { getDriverNotes, patchDriverNotes, getSentNotifications, waitlistAllocation, unpublishEarnings, retryTelematics, importPayrollSheet };
}
