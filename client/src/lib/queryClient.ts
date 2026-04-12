import { QueryClient, QueryFunction } from "@tanstack/react-query";

const IS_STATIC = import.meta.env.VITE_DATA_MODE === "static";

// In static mode, data comes from pre-built JSON files in /data/.
// In api mode (dev), data comes from the Express server.
const API_BASE = IS_STATIC
  ? "."
  : "__PORT_5000__".startsWith("__") ? "." : "__PORT_5000__";

// Map API query keys to static JSON file paths
const STATIC_PATH_MAP: Record<string, string> = {
  "/api/dashboard": "/data/dashboard.json",
  "/api/relative-strength": "/data/rs.json",
};

function resolveStaticPath(queryKey: readonly unknown[]): string {
  // Extract the base path (first element) and ignore query params for static mode
  const basePath = String(queryKey[0]);
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

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
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
    return await res.json();
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
