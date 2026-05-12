import React, { createContext, useContext } from "react";
import { useGetMyProfile } from "@workspace/api-client-react";
import { useAuth } from "@clerk/clerk-expo";

interface DriverProfile {
  id: string;
  userId: string;
  status: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  fleetType: string | null;
  [key: string]: unknown;
}

interface DriverContextValue {
  profile: DriverProfile | null;
  isLoading: boolean;
  refetch: () => void;
}

const DriverContext = createContext<DriverContextValue>({
  profile: null,
  isLoading: true,
  refetch: () => {},
});

export function DriverProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const query = useGetMyProfile({
    query: { enabled: isLoaded && !!isSignedIn },
  });

  const profile = (query.data as any)?.data ?? null;

  return (
    <DriverContext.Provider
      value={{
        profile,
        isLoading: query.isLoading,
        refetch: query.refetch,
      }}
    >
      {children}
    </DriverContext.Provider>
  );
}

export function useDriver() {
  return useContext(DriverContext);
}
