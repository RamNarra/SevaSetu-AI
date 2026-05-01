'use client';

import { Timestamp } from 'firebase/firestore/lite';
import {
  seedLocalities,
  seedVolunteers,
  seedReports,
  seedExtractedSignals,
  seedCampPlans,
  seedPatientVisits,
  seedMedicineStock,
  seedVolunteerPresence,
  seedAssignments,
} from '@/data/seed';
import { Locality, VolunteerProfile, RawReport, ExtractedSignal, CampPlan, PatientVisit, MedicineStock, VolunteerPresence } from '@/types';

interface AssignmentRecord {
  id: string;
  volunteerId: string;
  campId: string;
  role: string;
  volunteerName: string;
  matchScore: number;
  matchReasoning: string;
  confirmed: boolean;
  assignedAt: { seconds: number; nanoseconds: number };
  eventLog?: { timestamp: string; type: string; message: string; actor: string }[];
}

type DemoCollectionKey =
  | 'localities'
  | 'volunteers'
  | 'rawReports'
  | 'extractedReports'
  | 'camps'
  | 'visits'
  | 'medicines'
  | 'volunteerPresence'
  | 'assignments';

type DemoIdentifiable = {
  id?: string;
  uid?: string;
};

const firestoreToDemoCollection: Record<string, DemoCollectionKey> = {
  localities: 'localities',
  volunteer_profiles: 'volunteers',
  raw_reports: 'rawReports',
  extracted_reports: 'extractedReports',
  camp_plans: 'camps',
  patient_visits: 'visits',
  medicine_stock: 'medicines',
  volunteer_presence: 'volunteerPresence',
  assignments: 'assignments',
};

/**
 * A purely static, in-memory database for demo purposes.
 * This ensures the app works perfectly even if Firebase is disconnected or rules are locked.
 */
class DemoDatabase {
  localities: Locality[] = seedLocalities as Locality[];
  volunteers: VolunteerProfile[] = seedVolunteers as VolunteerProfile[];
  rawReports: RawReport[] = seedReports.map((report, index) => ({
    id: `report_${String(index + 1).padStart(3, '0')}`,
    clientEventId: `report_${String(index + 1).padStart(3, '0')}`,
    submittedBy: 'demo-coordinator',
    submitterName: 'Demo Coordinator',
    rawText: report.rawText,
    fileUrls: [],
    source: report.source,
    status: report.status,
    storageUri: null,
    createdAt: Timestamp.now(),
  })) as RawReport[];
  extractedReports: ExtractedSignal[] = seedExtractedSignals.map((signal, index) => ({
    id: `report_${String(index + 1).padStart(3, '0')}`,
    ...signal,
  })) as ExtractedSignal[];
  camps: CampPlan[] = seedCampPlans as CampPlan[];
  visits: PatientVisit[] = seedPatientVisits as PatientVisit[];
  medicines: MedicineStock[] = seedMedicineStock as MedicineStock[];
  volunteerPresence: VolunteerPresence[] = seedVolunteerPresence as VolunteerPresence[];
  assignments: AssignmentRecord[] = seedAssignments as unknown as AssignmentRecord[];

  private resolveCollectionKey(collectionName: string): DemoCollectionKey | null {
    return firestoreToDemoCollection[collectionName] ?? null;
  }

  getCollection<T>(collectionName: string): T[] {
    const collectionKey = this.resolveCollectionKey(collectionName);
    if (!collectionKey) {
      return [];
    }

    return this[collectionKey] as unknown as T[];
  }

  getDocument<T extends DemoIdentifiable>(collectionName: string, docId: string): T | null {
    const list = this.getCollection<T>(collectionName);
    return list.find((item) => item.id === docId || item.uid === docId) ?? null;
  }

  isDemoMode() {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sevasetu_demo_mode') === 'true';
  }

  enable() {
    localStorage.setItem('sevasetu_demo_mode', 'true');
    window.location.reload();
  }

  disable() {
    localStorage.removeItem('sevasetu_demo_mode');
    window.location.reload();
  }
}

export const demoDb = new DemoDatabase();
