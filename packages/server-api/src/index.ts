import type { Hono } from "hono";

type AppSchema = {
  "/me": {
    $get: {
      input: {};
      output: { email?: string; sub?: string };
      outputFormat: "json";
      status: 200;
    };
  };
  "/zaim/auth/status": {
    $get: {
      input: {};
      output: { connected: true; zaimUserId: string } | { connected: false };
      outputFormat: "json";
      status: 200;
    };
  };
  "/zaim/auth/token": {
    $delete: {
      input: {};
      output: { ok: true };
      outputFormat: "json";
      status: 200;
    };
  };
};

export type AppType = Hono<Record<string, never>, AppSchema, "/">;
