const TOKEN_KEY = "office_access_token";
const LEGACY_TOKEN_KEY = "manager_jwt";

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export function apiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
}

export function getStoredToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) return token;
  const legacyToken = localStorage.getItem(LEGACY_TOKEN_KEY);
  if (legacyToken) {
    localStorage.setItem(TOKEN_KEY, legacyToken);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  }
  return legacyToken;
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
}

const FIELD_NAMES: Record<string, string> = {
  email: "Email",
  password: "Password",
  assigned_to_name: "Technician name",
  assigned_to_phone: "Technician phone",
  assigned_to_email: "Technician email",
  date_assigned: "Assigned date",
  service_address: "Property address",
  tenant_names: "Tenant name",
  tenant_phone: "Tenant phone",
  priority: "Priority",
  category: "Category",
  name: "Name",
};

function friendlyValidationMessage(item: Record<string, unknown>): string {
  const location = Array.isArray(item.loc) ? item.loc : [];
  const field = String(location[location.length - 1] || "This field");
  const label = FIELD_NAMES[field] || field.replaceAll("_", " ");
  const type = String(item.type || "");
  if (type === "missing") return `${label} is required.`;
  if (type.includes("too_short")) return `${label} is too short.`;
  if (type.includes("too_long")) return `${label} is too long.`;
  if (type.includes("date")) return `${label} must be a valid date.`;
  if (type.includes("email")) return `${label} must be a valid email address.`;
  return `${label}: ${String(item.msg || "Please check this value.")}`;
}

function parseDetail(body: unknown): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object") {
            return friendlyValidationMessage(item as Record<string, unknown>);
          }
          return JSON.stringify(item);
        })
        .join("; ");
    }
    if (detail != null) return JSON.stringify(detail);
  }
  return "Request failed";
}

export function friendlyErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const detail = error.detail;
    const messages: Record<string, string> = {
      "Invalid credentials": "The email or password is incorrect. Check both and try again.",
      "Not authenticated": "Your office session has expired. Please sign in again.",
      "Invalid or expired token": "Your office session has expired. Please sign in again.",
      "User not found": "This office account is no longer available.",
      "Work order not found": "This work order is unavailable or has already been deleted.",
      "Category already exists": "That category already exists. Try a different name.",
      "Category not found": "That category is no longer active. Refresh the page and try again.",
      "Cannot complete before start": "Start the job before marking it complete.",
      "Tenant must sign before technician": "The tenant must sign before the technician can sign.",
      "Tenant has already signed": "The tenant signature has already been saved.",
      "Technician has already signed": "The technician signature has already been saved.",
      "Work order is signed off and locked for writes": "This work order is completed and cannot be changed.",
      "PDF file not found": "The PDF file is unavailable. An office Admin should generate a new copy.",
      "Work order signatures were not saved because PDF generation is unavailable": "The signature was not saved because the completion PDF could not be generated. Please try again after the PDF service is available.",
      "Work order signature or PDF could not be saved atomically": "Nothing was saved because the signature and completion PDF could not be completed safely. Please try again.",
    };
    if (messages[detail]) return messages[detail];
    if (detail.startsWith("Unknown checklist category")) {
      return "That category is no longer active. Choose an active category and try again.";
    }
    if (detail.startsWith("Unknown priority")) {
      return "That priority is not available. Choose emergency, urgent, or standard.";
    }
    if (detail.startsWith("Work order can only be started")) {
      return "This job has already started or is no longer available to start.";
    }
    if (detail.startsWith("Items can only be updated")) {
      return "Item details can be changed after the job has started.";
    }
    if (detail.startsWith("Photos can be uploaded")) {
      return "Photos can be added after the job has started.";
    }
    if (detail.startsWith("Each task needs a before photo")) {
      return "Add a before photo for every task before finishing the job.";
    }
    if (detail.startsWith("Each task needs an after photo")) {
      return "Add an after photo for every task, or choose No picture if one cannot be captured.";
    }
    return detail;
  }
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return "We could not reach the server. Check that the API is running and try again.";
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

async function readError(res: Response): Promise<ApiError> {
  const text = await res.text();
  try {
    return new ApiError(res.status, parseDetail(JSON.parse(text)));
  } catch {
    return new ApiError(res.status, text || res.statusText || "Request failed");
  }
}

function handleUnauthorized(auth: boolean, status: number): void {
  if (!auth || status !== 401) return;
  clearStoredToken();
  if (!window.location.pathname.startsWith("/login")) {
    window.location.assign("/login");
  }
}


type RequestOpts = {
  auth?: boolean;
  method?: string;
  body?: BodyInit | null;
  headers?: Record<string, string>;
};

export async function apiRequest<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const auth = Boolean(opts.auth);
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  if (auth) {
    const token = getStoredToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${apiBaseUrl()}${path}`, {
    method: opts.method || "GET",
    body: opts.body,
    headers,
  });
  if (!res.ok) {
    handleUnauthorized(auth, res.status);
    throw await readError(res);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function apiJson<T>(
  path: string,
  opts: { auth?: boolean; method?: string; json?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;
  if (opts.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.json);
  }
  return apiRequest<T>(path, {
    auth: opts.auth,
    method: opts.method,
    body,
    headers,
  });
}

export async function apiBlob(path: string, auth = false): Promise<{ blob: Blob; filename: string }> {
  const headers: Record<string, string> = {};
  if (auth) {
    const token = getStoredToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${apiBaseUrl()}${path}`, { headers });
  if (!res.ok) {
    handleUnauthorized(auth, res.status);
    throw await readError(res);
  }
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = /filename="?([^"]+)"?/i.exec(disposition);
  const filename = match?.[1] || "work-order.pdf";
  return { blob: await res.blob(), filename };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function qs(params: Record<string, string | number | undefined | boolean | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}
