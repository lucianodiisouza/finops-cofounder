/** Cliente da API JSON do FinOps. Toda chamada vai com o cookie de sessão. */

export type User = { id: string; email: string };

export type Project = {
  id: string;
  name: string;
  description: string;
  color: string;
  archived: boolean;
};

export type Service = {
  id: string;
  project_id: string;
  name: string;
  category: string;
  amount_cents: number;
  currency: string;
  billing_cycle: "monthly" | "yearly";
  starts_on: string;
  ends_on: string | null;
  notes: string;
};

export type SummaryService = Service & {
  original_cents: number;
  converted_cents: number;
  rate: number | null;
  missing_rate: boolean;
};

export type DashboardProject = {
  project_id: string;
  name: string;
  color: string;
  total_cents: number;
  share_percent: number;
  service_count: number;
  missing_rate: boolean;
};

export type Dashboard = {
  month: string;
  total_cents: number;
  previous_total_cents: number;
  delta_cents: number;
  delta_percent: number | null;
  projects: DashboardProject[];
  missing_currencies: string[];
};

export type EvolutionProject = {
  project_id: string;
  name: string;
  color: string;
  total_cents: number;
};

export type EvolutionPoint = {
  month: string;
  total_cents: number;
  projects: EvolutionProject[];
};

export type ProjectSummary = {
  project: Project;
  month: string;
  total_cents: number;
  services: SummaryService[];
  categories: { category: string; total_cents: number }[];
  evolution: EvolutionPoint[];
  missing_currencies: string[];
};

export type Rate = { id: string; currency: string; month: string; rate: number };

/** Erro de API com o status HTTP, para as telas distinguirem 401 de 400. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: "same-origin",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(response.status, body?.error ?? "Não foi possível completar a operação.");
  }
  return body as T;
}

const json = (body: unknown) => JSON.stringify(body);

export const api = {
  me: () => request<User>("/me"),
  login: (email: string, password: string) =>
    request<User>("/auth/login", { method: "POST", body: json({ email, password }) }),
  register: (email: string, password: string) =>
    request<User>("/auth/register", { method: "POST", body: json({ email, password }) }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),

  listProjects: () => request<Project[]>("/projects"),
  createProject: (body: { name: string; description: string; color: string }) =>
    request<Project>("/projects", { method: "POST", body: json(body) }),
  updateProject: (id: string, body: { name: string; description: string; color: string }) =>
    request<Project>(`/projects/${id}`, { method: "PUT", body: json(body) }),
  archiveProject: (id: string, archived: boolean) =>
    request<Project>(`/projects/${id}/archive`, { method: "POST", body: json({ archived }) }),
  deleteProject: (id: string) => request<void>(`/projects/${id}`, { method: "DELETE" }),
  projectSummary: (id: string, month: string) =>
    request<ProjectSummary>(`/projects/${id}/summary?month=${month}`),

  createService: (projectId: string, body: ServicePayload) =>
    request<Service>(`/projects/${projectId}/services`, { method: "POST", body: json(body) }),
  updateService: (id: string, body: ServicePayload) =>
    request<Service>(`/services/${id}`, { method: "PUT", body: json(body) }),
  deleteService: (id: string) => request<void>(`/services/${id}`, { method: "DELETE" }),

  listRates: () => request<Rate[]>("/rates"),
  upsertRate: (body: { currency: string; month: string; rate: number }) =>
    request<Rate>("/rates", { method: "PUT", body: json(body) }),
  deleteRate: (id: string) => request<void>(`/rates/${id}`, { method: "DELETE" }),

  dashboard: (month: string) => request<Dashboard>(`/dashboard?month=${month}`),
  evolution: (month: string, months = 12) =>
    request<{ months: EvolutionPoint[] }>(`/evolution?month=${month}&months=${months}`),
};

export type ServicePayload = {
  name: string;
  category: string;
  amount_cents: number;
  currency: string;
  billing_cycle: string;
  starts_on: string;
  ends_on: string | null;
  notes: string;
};
