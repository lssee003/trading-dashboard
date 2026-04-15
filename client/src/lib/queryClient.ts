import { QueryClient, QueryFunction } from "@tanstack/react-query";

const IS_STATIC = import.meta.env.VITE_DATA_MODE === "static";

// In static mode, data comes from pre-built JSON files in /data/.
// In api mode (dev), data comes from the Express server.
// Use Vite's BASE_URL which respects the base config in vite.config.ts
const API_BASE = IS_STATIC
  ? import.meta.env.BASE_URL.replace(/\/$/, "") // Remove trailing slash
  : "__PORT_5000__".startsWith("__") ? "." : "__PORT_5000__";

// Map API query keys to static JSON file paths
const STATIC_PATH_MAP: Record<string, string> = {
  "/api/dashboard": "/data/dashboard.json",
  "/api/sheets": "/data/sheets.json",
};

function resolveStaticPath(queryKey: readonly unknown[]): string {
  const basePath = String(queryKey[0]);

  // RS endpoint has per-lookback files (rs-10.json, rs-25.json, etc.)
  if (basePath === "/api/relative-strength") {
    const params = new URLSearchParams(String(queryKey[1] ?? "").replace(/^\?/, ""));
    const lookback = params.get("lookback") || "25";
    return `/data/rs-${lookback}.json`;
  }

  return STATIC_PATH_MAP[basePath] || basePath;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

export const getQueryFn: <T>(options: {
  on401: "returnNull" | "throw";
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    let url: string;
    if (IS_STATIC) {
      url = `${API_BASE}${resolveStaticPath(queryKey)}`;
    } else {
      const path = queryKey.join("/").replace(/\/\/+/g, "/");
      url = `${API_BASE}${path}`;
    }

    const res = await fetch(url);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      // Static mode: no polling, data is a daily snapshot
      // API mode: poll every 45s
      refetchInterval: IS_STATIC ? false : 45_000,
      refetchOnWindowFocus: !IS_STATIC,
      staleTime: IS_STATIC ? Infinity : 30_000,
      retry: 2,
    },
    mutations: {
      retry: false,
    },
  },
});
