export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: string;
  meta?: Record<string, unknown>;
}

export type ProfileStatus =
  | "incomplete"
  | "pending"
  | "approved"
  | "rejected"
  | "suspended";

export type TelematicsSyncStatus = "synced" | "pending" | "failed";

export interface DriverProfile {
  id: string;
  userId: string;
  email: string;
  status: ProfileStatus;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  idNumber: string | null;
  streetAddress: string | null;
  suburb: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  bankName: string | null;
  accountNumber: string | null;
  accountType: string | null;
  branchCode: string | null;
  fleetType: "electric" | "lpg" | null;
  boltDriverId: string | null;
  boltDeclarationAccepted: string | null;
  rejectionReason: string | null;
  telematicsRegistered: boolean;
  telematicsSyncStatus: TelematicsSyncStatus | null;
  telematicsLastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DriverDocument {
  id: string;
  documentType: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  status: "pending-review" | "verified" | "rejected";
  reviewNotes: string | null;
  createdAt: string;
  deletedAt: string | null;
  objectPath: string;
}

export interface Shift {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  description: string | null;
  status: string;
  fleetType: string | null;
}

export interface VehicleSummary {
  id: string;
  registrationNumber: string;
  make: string;
  model: string;
  year: number | null;
  fleetType: string;
  status: string;
}

export interface AllocationVehicle {
  assignment: {
    id: string;
    status: string;
    lastUnlockAt: string | null;
    lastUnlockResult: string | null;
  };
  vehicle: VehicleSummary;
}

export interface Allocation {
  id: string;
  status: "requested" | "confirmed" | "cancelled" | "declined";
  requestedAt: string;
  shift: Shift | null;
  vehicleAssignment?: AllocationVehicle | null;
}

export interface VehicleAssignmentFull {
  assignment: {
    id: string;
    status: string;
    lastUnlockAt: string | null;
    lastUnlockResult: string | null;
  };
  vehicle: VehicleSummary;
}

export interface Earning {
  id: string;
  periodStart: string;
  periodEnd: string;
  grossAmountCents: number;
  deductionsCents: number;
  incentivesCents: number;
  penaltiesCents: number;
  netAmountCents: number;
  tripCount: number;
  notes: string | null;
  status: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  status: "read" | "unread";
  createdAt: string;
}

export interface DashboardSummary {
  profile: DriverProfile;
  activeVehicleAssignment: VehicleAssignmentFull | null;
  nextShift: {
    shift: Shift;
    allocation: Allocation;
  } | null;
  weeklyEarningsCents: number;
  shiftsThisWeek: number;
  unreadNotificationsCount: number;
  latestNotifications: Notification[];
}

export interface Agreement {
  id: string;
  title: string;
  version: string;
  content: string;
  effectiveDate: string;
}

export interface AgreementSignature {
  id: string;
  agreementId: string;
  agreementVersion: string;
  legalName: string;
  signedAt: string;
  signatureObjectPath: string | null;
  status: string;
}

export function apiData<T>(response: unknown): T | null {
  if (!response || typeof response !== "object") return null;
  const envelope = response as ApiEnvelope<T>;
  return envelope?.data ?? null;
}
