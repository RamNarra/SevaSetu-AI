// ============================================================
// SevaSetu AI — Core Type Definitions
// ============================================================

import { Timestamp } from 'firebase/firestore/lite';

// ---- Enums ----

export enum UserRole {
  COORDINATOR = 'COORDINATOR',
  FIELD_VOLUNTEER = 'FIELD_VOLUNTEER',
  DOCTOR = 'DOCTOR',
  PHARMACIST = 'PHARMACIST',
  SUPPORT = 'SUPPORT',
}

export enum UrgencyLevel {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum VisitStage {
  REGISTERED = 'REGISTERED',
  TRIAGED = 'TRIAGED',
  IN_CONSULTATION = 'IN_CONSULTATION',
  AT_PHARMACY = 'AT_PHARMACY',
  REFERRED = 'REFERRED',
  COMPLETED = 'COMPLETED',
  FOLLOWUP = 'FOLLOWUP',
}

export enum CampStatus {
  DRAFT = 'DRAFT',
  PLANNED = 'PLANNED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum ReportStatus {
  RAW = 'RAW',
  PROCESSING = 'PROCESSING',
  EXTRACTED = 'EXTRACTED',
  FAILED = 'FAILED',
}

// ---- Firestore Document Interfaces ----

export interface UserDoc {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  role: UserRole;
  phone?: string;
  createdAt: Timestamp;
}

export interface VolunteerProfile {
  id?: string;
  userId: string;
  displayName: string;
  photoURL?: string;
  skills: string[];
  certifications: string[];
  languages: string[];
  availability: 'AVAILABLE' | 'BUSY' | 'ON_LEAVE';
  preferredAreas: string[];
  travelRadiusKm: number;
  completedCamps: number;
  rating: number; // 0-5
  role: UserRole;
  phone?: string;
  email?: string;
}

export interface CommunityReport {
  id?: string;
  submittedBy: string;
  submitterName?: string;
  rawText: string;
  fileUrls: string[];
  source: 'paste' | 'upload' | 'survey' | 'field_note';
  locality?: string;
  status: ReportStatus;
  createdAt: Timestamp;
}

export interface ExtractedReport {
  id?: string;
  reportId: string;
  locality: string;
  issueTypes: string[];
  urgencySignals: string[];
  estimatedAffected: number;
  supportNeeded: string[];
  confidence: number; // 0-1
  entities: Record<string, string[]>;
  processedAt: Timestamp;
}

export interface UrgencyBreakdown {
  severity: number;
  recency: number;
  repeatComplaints: number;
  serviceGap: number;
  vulnerability: number;
}

export interface Locality {
  id?: string;
  name: string;
  district: string;
  state: string;
  coordinates: { lat: number; lng: number };
  urgencyScore: number; // 0-100
  urgencyLevel: UrgencyLevel;
  urgencyBreakdown: UrgencyBreakdown;
  baseScore: number;
  aiAdjustment: number;
  aiReasoning: string;
  lastCampDate?: Timestamp;
  totalCamps: number;
  population: number;
  vulnerabilityIndex: number; // 0-1
  issues: string[];
}

export interface RequiredRoles {
  doctors: number;
  pharmacists: number;
  fieldVolunteers: number;
  support: number;
}

export interface CampPlan {
  id?: string;
  localityId: string;
  localityName: string;
  title: string;
  scheduledDate: Timestamp;
  status: CampStatus;
  predictedTurnout: number;
  requiredRoles: RequiredRoles;
  assignedStaff: string[]; // volunteer IDs
  coordinatorId: string;
  notes: string;
  createdAt: Timestamp;
  summary?: string; // AI-generated post-camp summary
}

export interface Assignment {
  id?: string;
  campId: string;
  volunteerId: string;
  volunteerName: string;
  role: UserRole;
  matchScore: number; // 0-100
  matchReasoning: string;
  confirmed: boolean;
  assignedAt: Timestamp;
}

export interface PatientVisit {
  id?: string;
  campId: string;
  patientName: string;
  age: number;
  gender: 'M' | 'F' | 'OTHER';
  stage: VisitStage;
  chiefComplaint: string;
  triagePriority: UrgencyLevel;
  consultationNotes?: string;
  prescriptions: string[];
  referralNeeded: boolean;
  followupNeeded: boolean;
  timestamps: {
    registered?: Timestamp;
    triaged?: Timestamp;
    consultationStart?: Timestamp;
    consultationEnd?: Timestamp;
    pharmacy?: Timestamp;
    completed?: Timestamp;
  };
}

export interface MedicineStock {
  id?: string;
  campId: string;
  medicineName: string;
  category: string;
  quantityAvailable: number;
  quantityDispensed: number;
  unit: string;
  expiryDate: Timestamp;
}

export interface DispenseLog {
  id?: string;
  visitId: string;
  campId: string;
  medicineId: string;
  medicineName: string;
  quantity: number;
  dispensedBy: string;
  dispensedAt: Timestamp;
}

export interface Followup {
  id?: string;
  visitId: string;
  campId: string;
  patientName: string;
  reason: string;
  scheduledDate: Timestamp;
  status: 'PENDING' | 'COMPLETED' | 'MISSED';
  notes: string;
  assignedTo?: string;
}

export interface AuditLog {
  id?: string;
  userId: string;
  userName: string;
  action: string;
  collection: string;
  documentId: string;
  timestamp: Timestamp;
  details: string;
}

// ---- AI Response Types ----

export interface ExtractionResult {
  locality: string;
  issueTypes: string[];
  urgencySignals: string[];
  estimatedAffected: number;
  supportNeeded: string[];
  confidence: number;
  entities: Record<string, string[]>;
}

export interface UrgencyScoreResult {
  score: number;
  breakdown: UrgencyBreakdown;
  aiAdjustment: number;
  reasoning: string;
}

export interface StaffRecommendation {
  volunteerId: string;
  volunteerName: string;
  role: UserRole;
  matchScore: number;
  reasoning: string;
}

export interface CampSummary {
  totalPatients: number;
  consultations: number;
  medicinesDispensed: number;
  referrals: number;
  followupsNeeded: number;
  volunteerHours: number;
  summaryText: string;
  recommendations: string[];
}
