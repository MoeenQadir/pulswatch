import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(80),
  email: z.string().email("Invalid email address").max(200),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(200)
    .regex(/[a-zA-Z]/, "Password must contain a letter")
    .regex(/[0-9]/, "Password must contain a number"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const monitorCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  url: z
    .string()
    .trim()
    .refine(
      (v) => {
        try {
          const u = new URL(v);
          return (
            u.protocol === "http:" ||
            u.protocol === "https:" ||
            u.protocol === "tcp:"
          );
        } catch {
          return false;
        }
      },
      "Must be a valid http(s):// or tcp:// URL"
    ),
  method: z.enum(["GET", "HEAD"]).default("GET"),
  expectedStatus: z.coerce.number().int().min(100).max(599).default(200),
  timeoutMs: z.coerce.number().int().min(1000).max(30000).default(10000),
  intervalSec: z.coerce.number().int().min(30).max(3600).default(60),
  maxRetries: z.coerce.number().int().min(0).max(5).default(2),
  // ── Smart checks (Option 2) ──
  kind: z.enum(["HTTP", "HEARTBEAT"]).default("HTTP"),
  keyword: z.string().trim().max(500).optional(),
  forbiddenKeyword: z.string().trim().max(500).optional(),
  sslCheckEnabled: z.boolean().default(false),
  sslWarnDays: z.coerce.number().int().min(1).max(90).default(14),
  confirmFailures: z.coerce.number().int().min(1).max(5).default(1),
  heartbeatIntervalSec: z.coerce.number().int().min(60).max(86400).default(3600),
  heartbeatGraceSec: z.coerce.number().int().min(0).max(86400).default(300),
});

export const monitorUpdateSchema = monitorCreateSchema.partial().extend({
  /** pause/resume convenience flag — mapped to status by the API */
  paused: z.boolean().optional(),
});

export const webhookCreateSchema = z.object({
  url: z
    .string()
    .url()
    .refine((v) => v.startsWith("https://"), "Webhook URL must use HTTPS"),
  events: z
    .array(z.enum(["MONITOR_DOWN", "MONITOR_UP", "INCIDENT_CREATED", "INCIDENT_UPDATED"]))
    .min(1)
    .default(["MONITOR_DOWN", "MONITOR_UP"]),
});

export const incidentUpdateSchema = z.object({
  status: z.enum(["INVESTIGATING", "IDENTIFIED", "MONITORING", "RESOLVED"]),
  cause: z.string().max(500).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type MonitorCreateInput = z.infer<typeof monitorCreateSchema>;
export type MonitorUpdateInput = z.infer<typeof monitorUpdateSchema>;
export type WebhookCreateInput = z.infer<typeof webhookCreateSchema>;
export type IncidentUpdateInput = z.infer<typeof incidentUpdateSchema>;
