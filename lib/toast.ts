"use client";

import hotToast from "react-hot-toast";
import { describeError } from "@/lib/api";

/**
 * One place for user feedback: toast.success() on 2xx, toast.error() on 4xx/5xx. Errors
 * surface the backend's own message (e.g. "Product cannot be deleted while it has active
 * orders") rather than a generic failure.
 */
export const toast = {
  success: (message: string) => hotToast.success(message),
  error: (errOrMessage: unknown) =>
    hotToast.error(typeof errOrMessage === "string" ? errOrMessage : describeError(errOrMessage)),
  /** Wrap a request: success toast on resolve, backend error on reject; rethrows so callers can react. */
  async promise<T>(work: Promise<T>, success: string | ((value: T) => string)): Promise<T> {
    try {
      const value = await work;
      hotToast.success(typeof success === "function" ? success(value) : success);
      return value;
    } catch (e) {
      hotToast.error(describeError(e));
      throw e;
    }
  },
};
