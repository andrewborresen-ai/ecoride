import { logger } from "../../lib/logger";

const BASE_URL = process.env.TELEMATICS_API_URL ?? "";
const API_KEY = process.env.TELEMATICS_API_KEY ?? "";

function headers() {
  return {
    "Content-Type": "application/json",
    "X-Api-Key": API_KEY,
  };
}

async function post(path: string, body: Record<string, unknown>) {
  if (!BASE_URL) {
    logger.warn({ path }, "Telematics API URL not configured — skipping call");
    return { success: false, error: "telematics_not_configured", data: null };
  }
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      logger.warn({ path, status: res.status }, "Telematics API error response");
      return { success: false, error: `http_${res.status}`, data };
    }
    return { success: true, error: null, data };
  } catch (err) {
    logger.error({ err, path }, "Telematics API request failed");
    return { success: false, error: "network_error", data: null };
  }
}

async function get(path: string) {
  if (!BASE_URL) {
    logger.warn({ path }, "Telematics API URL not configured — skipping call");
    return { success: false, error: "telematics_not_configured", data: null };
  }
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "GET",
      headers: headers(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: `http_${res.status}`, data };
    }
    return { success: true, error: null, data };
  } catch (err) {
    logger.error({ err, path }, "Telematics API request failed");
    return { success: false, error: "network_error", data: null };
  }
}

export interface RegisterDriverResult {
  success: boolean;
  telematicsDriverId?: string;
  error?: string | null;
}

export async function registerDriver(params: {
  driverProfileId: string;
  firstName: string | null;
  lastName: string | null;
  idNumber: string | null;
  phone: string | null;
}): Promise<RegisterDriverResult> {
  const result = await post("/drivers/register", {
    externalId: params.driverProfileId,
    firstName: params.firstName,
    lastName: params.lastName,
    idNumber: params.idNumber,
    phone: params.phone,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    telematicsDriverId: (result.data as { driverId?: string })?.driverId,
  };
}

export interface CreateAssignmentResult {
  success: boolean;
  telematicsAssignmentId?: string;
  error?: string | null;
}

export async function createAssignment(params: {
  vehicleAssignmentId: string;
  telematicsDriverId: string;
  telematicsVehicleId: string;
  assignmentStart: Date;
  assignmentEnd: Date;
}): Promise<CreateAssignmentResult> {
  const result = await post("/assignments/create", {
    externalId: params.vehicleAssignmentId,
    driverId: params.telematicsDriverId,
    vehicleId: params.telematicsVehicleId,
    startTime: params.assignmentStart.toISOString(),
    endTime: params.assignmentEnd.toISOString(),
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    telematicsAssignmentId: (result.data as { assignmentId?: string })?.assignmentId,
  };
}

export interface UnlockResult {
  success: boolean;
  telematicsRequestId?: string;
  failureReason?: string;
  error?: string | null;
}

export async function requestUnlock(params: {
  vehicleAccessEventId: string;
  telematicsAssignmentId: string;
  telematicsDriverId: string;
  telematicsVehicleId: string;
}): Promise<UnlockResult> {
  const result = await post("/vehicles/unlock", {
    accessEventId: params.vehicleAccessEventId,
    assignmentId: params.telematicsAssignmentId,
    driverId: params.telematicsDriverId,
    vehicleId: params.telematicsVehicleId,
  });

  if (!result.success) {
    return { success: false, error: result.error, failureReason: result.error ?? undefined };
  }

  const data = result.data as { requestId?: string; failureReason?: string; status?: string };
  return {
    success: data?.status !== "failed",
    telematicsRequestId: data?.requestId,
    failureReason: data?.failureReason,
  };
}

export interface RegisterVehicleResult {
  success: boolean;
  telematicsVehicleId?: string;
  error?: string | null;
}

export async function registerVehicle(params: {
  vehicleId: string;
  registrationNumber: string;
  make: string | null;
  model: string | null;
}): Promise<RegisterVehicleResult> {
  const result = await post("/vehicles/register", {
    externalId: params.vehicleId,
    registrationNumber: params.registrationNumber,
    make: params.make,
    model: params.model,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    telematicsVehicleId: (result.data as { vehicleId?: string })?.vehicleId,
  };
}
