import type { Request } from "express";
import { HttpError } from "./httpError.ts";

const HEADER_NAME = "x-device-key";

export function getDeviceKey(req: Request): string | null {
  const headerValue = req.header(HEADER_NAME);
  if (headerValue && headerValue.trim().length) {
    return headerValue.trim();
  }

  const queryValue = req.query.deviceKey;
  if (typeof queryValue === "string" && queryValue.trim().length) {
    return queryValue.trim();
  }

  return null;
}

export function requireDeviceKey(req: Request): string {
  const deviceKey = getDeviceKey(req);
  if (!deviceKey) {
    throw new HttpError(
      400,
      "Provide device key via x-device-key header or deviceKey query parameter.",
      "DEVICE_KEY_REQUIRED"
    );
  }
  return deviceKey;
}
