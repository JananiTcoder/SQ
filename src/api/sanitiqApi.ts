import axios from "axios";
import type { Complaint, ComplaintStatus, LoginRole, Restroom, RiskPrediction, SummaryMetrics, WardRisk } from "../types/sanitiq";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "",
  timeout: 3500,
  withCredentials: true,
});

const read = <T>(payload: unknown): T => {
  if (typeof payload === "string") {
    throw new Error("Received string instead of JSON. The backend might be offline.");
  }
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
};

export const sanitiqApi = {
  async login(email: string, password: string, role: LoginRole) {
    const response = await api.post("/api/login", { email, password, role, loginType: role });
    return read(response.data);
  },
  async logout() {
    const response = await api.post("/api/logout");
    return read(response.data);
  },
  async summary() {
    const response = await api.get<SummaryMetrics>("/api/summary");
    return read<SummaryMetrics>(response.data);
  },
  async toilets() {
    const response = await api.get<Restroom[]>("/api/toilets");
    return read<Restroom[]>(response.data);
  },
  async toilet(id: string) {
    const response = await api.get<Restroom>(`/api/toilet/${id}`);
    return read<Restroom>(response.data);
  },
  async complaints() {
    const response = await api.get<Complaint[]>("/api/complaints");
    return read<Complaint[]>(response.data);
  },
  async addComplaint(payload: Omit<Complaint, "id" | "createdAt" | "status">) {
    const response = await api.post<Complaint>("/api/complaints", payload);
    return read<Complaint>(response.data);
  },
  async updateComplaintStatus(id: string, status: ComplaintStatus) {
    const response = await api.patch<Complaint>(`/api/complaints/${id}/status`, { status });
    return read<Complaint>(response.data);
  },
  async wardRisk() {
    const response = await api.get<WardRisk[]>("/api/ward-risk");
    return read<WardRisk[]>(response.data);
  },
  async riskPrediction(id: string) {
    const response = await api.get<RiskPrediction>(`/api/risk-prediction/${id}`);
    return read<RiskPrediction>(response.data);
  },
  async hygieneAnalysis() {
    const response = await api.get("/api/hygiene-analysis");
    return read(response.data);
  },
};