import React, { createContext, useContext } from "react";
import { useGetMyProfile, getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@clerk/clerk-expo";
import { apiData } from "@/types/api";
import type { DriverProfile } from "@/types/api";

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
    query: {
      enabled: isLoaded && !!isSignedIn,
      queryKey: getGetMyProfileQueryKey(),
    },
  });

  const profile = apiData<DriverProfile>(query.data);

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
