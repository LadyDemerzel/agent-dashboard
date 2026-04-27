export type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  let payload: unknown = null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    payload = await response.json();
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}

export async function apiEnvelopeFetcher<T>(url: string): Promise<ApiEnvelope<T>> {
  return fetchJson<ApiEnvelope<T>>(url);
}

export async function apiDataFetcher<T>(url: string): Promise<T> {
  const payload = await apiEnvelopeFetcher<T>(url);
  if (!payload.success || payload.data === undefined) {
    throw new Error(payload.error || "Request failed");
  }
  return payload.data;
}

export async function jsonFetcher<T>(url: string, init?: RequestInit): Promise<T> {
  return fetchJson<T>(url, init);
}

export const realtimeSWRConfig = {
  revalidateOnFocus: true,
  keepPreviousData: true,
  dedupingInterval: 1000,
} as const;
