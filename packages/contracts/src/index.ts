import { z } from "zod";

export const SCHEMA_VERSION = "1.0";

export const PROFILE = "shopify_checkout_entry_v1" as const;
export const ProfileSchema = z.literal(PROFILE);

export const VIEWPORTS = {
  mobile: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  desktop: { width: 1440, height: 900, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
} as const;
export type ViewportName = keyof typeof VIEWPORTS;
export const ViewportNameSchema = z.enum(["mobile", "desktop"]);

export const ErrorCode = z.enum([
  "INVALID_INPUT",
  "TARGET_NOT_AUTHORIZED",
  "QUOTE_EXPIRED",
  "QUOTE_SCOPE_MISMATCH",
  "PAYMENT_REQUIRED",
  "PAYMENT_UNVERIFIED",
  "PAYMENT_DENIED",
  "UNSUPPORTED_PROFILE",
  "IDEMPOTENCY_CONFLICT",
  "JOB_NOT_FOUND",
  "REPORT_ACCESS_DENIED",
  "RATE_LIMITED",
  "BROWSER_BLOCKED",
  "WORKER_TIMEOUT",
  "INTERNAL_FAILURE",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const InspectionStatus = z.enum([
  "AWAITING_SETTLEMENT",
  "PAYMENT_DENIED",
  "QUEUED",
  "STARTING",
  "RUNNING_MOBILE",
  "RUNNING_DESKTOP",
  "UPLOADING_EVIDENCE",
  "COMPLETED",
  "INCONCLUSIVE",
  "FAILED_INTERNAL",
  "CANCELLED",
]);
export type InspectionStatus = z.infer<typeof InspectionStatus>;
export const TERMINAL_STATUSES: readonly InspectionStatus[] = ["PAYMENT_DENIED", "COMPLETED", "INCONCLUSIVE", "FAILED_INTERNAL", "CANCELLED"];

export const Verdict = z.enum(["PASS", "FAIL", "INCONCLUSIVE"]);
export type Verdict = z.infer<typeof Verdict>;

export const StepResult = z.enum(["PENDING", "RUNNING", "PASS", "FAIL", "INCONCLUSIVE", "SKIPPED"]);
export type StepResult = z.infer<typeof StepResult>;

export const Blocker = z.enum([
  "ADD_TO_CART_NO_EFFECT",
  "CHECKOUT_ENTRY_BLOCKED",
  "BROWSER_BLOCKED",
  "PRODUCT_UNAVAILABLE",
  "UNSUPPORTED_MARKUP",
  "NAVIGATION_FAILED",
  "TARGET_LEFT_ALLOWLIST",
]);
export type Blocker = z.infer<typeof Blocker>;

export const QuoteRequest = z
  .object({
    product_url: z.string().url().max(2048),
    authorized_target_id: z.string().min(1).max(64),
    profile: ProfileSchema,
    viewports: z.array(ViewportNameSchema).min(1).max(2).default(["mobile", "desktop"]),
  })
  .strict();
export type QuoteRequest = z.infer<typeof QuoteRequest>;

export const InspectionRequest = z
  .object({
    quote_id: z.string().uuid(),
    product_url: z.string().url().max(2048),
    authorized_target_id: z.string().min(1).max(64),
    profile: ProfileSchema,
    idempotency_key: z.string().min(8).max(128),
    client_reference: z.string().max(128).optional(),
  })
  .strict();
export type InspectionRequest = z.infer<typeof InspectionRequest>;
