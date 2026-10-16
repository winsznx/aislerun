import type { NextFunction, Request, Response } from "express";

interface Window {
  startedAt: number;
  count: number;
}

// Fixed-window limiter keyed by client IP. In-memory is enough for the single API process this
// deployment runs; it resets on restart, which is acceptable for abuse throttling but not billing.
export function rateLimit(name: string, limit: number, windowMs: number) {
  const windows = new Map<string, Window>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${name}:${req.ip ?? "unknown"}`;
    const current = windows.get(key);
    const window = current && now - current.startedAt < windowMs ? current : { startedAt: now, count: 0 };
    window.count += 1;
    windows.set(key, window);
    if (windows.size > 10_000) {
      for (const [k, w] of windows) if (now - w.startedAt >= windowMs) windows.delete(k);
    }
    if (window.count > limit) {
      res.setHeader("Retry-After", String(Math.ceil((window.startedAt + windowMs - now) / 1000)));
      res.status(429).json({ ok: false, code: "RATE_LIMITED", message: "Too many requests. Slow down and retry later.", retryable: true, request_id: req.requestId });
      return;
    }
    next();
  };
}
