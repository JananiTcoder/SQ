export type Cleanliness = "Clean" | "Moderate" | "Dirty";
export type Availability = "Available" | "Occupied" | "Maintenance";
export type ComplaintStatus = "Pending" | "In Progress" | "Resolved";
export type Priority = "Low" | "Medium" | "High" | "Critical";
export type LoginRole = "admin" | "worker" | "public";

export interface Restroom {
  id: string;
  name: string;
  ward: string;
  area: string;
  latitude: number;
  longitude: number;
  hygieneScore: number;
  cleanliness: Cleanliness;
  availability: Availability;
  occupancy: number;
  odorLevel: number;
  humidity: number;
  ammonia: number;
  lastCleaned: string;
  aiPrediction: string;
  sensorOnline: boolean;
  footfall: number;
  rating: number;
  responseTime: string;
}

export interface Complaint {
  id: string;
  toiletId: string;
  toiletName: string;
  ward: string;
  reporter: string;
  issue: string;
  description: string;
  priority: Priority;
  status: ComplaintStatus;
  createdAt: string;
  imageName?: string;
  assignedTo?: string;
}

export interface WardRisk {
  ward: string;
  riskScore: number;
  level: "Low" | "Medium" | "High" | "Critical";
  toilets: number;
  complaints: number;
  forecast: number;
}

export interface SummaryMetrics {
  totalRestrooms: number;
  activeSensors: number;
  averageHygieneScore: number;
  pendingComplaints: number;
  cleaningEfficiency: number;
  aiRiskScore: number;
  sensorAlerts: number;
  responseTimeMinutes: number;
}

export interface TrendPoint {
  label: string;
  hygiene: number;
  risk: number;
  usage: number;
  complaints: number;
}

export interface RiskPrediction {
  riskLevel: "Low" | "Moderate" | "High" | "Critical";
  confidence: number;
  severity: string;
  maintenanceUrgency: string;
  drivers: string[];
}