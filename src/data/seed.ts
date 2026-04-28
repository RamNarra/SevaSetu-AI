import { Timestamp } from 'firebase/firestore/lite';
import {
  UserRole,
  UrgencyLevel,
  VisitStage,
  CampStatus,
  ReportStatus,
  type ExtractedSignal,
  type VolunteerPresence,
} from '@/types';

// ---- Localities ----
export const seedLocalities = [
  {
    name: 'Rampur Village',
    district: 'Barabanki',
    state: 'Uttar Pradesh',
    coordinates: { lat: 26.8, lng: 81.03 },
    urgencyScore: 82,
    urgencyLevel: UrgencyLevel.CRITICAL,
    urgencyBreakdown: { severity: 22, recency: 20, repeatComplaints: 15, serviceGap: 12, vulnerability: 13 },
    baseScore: 82,
    aiAdjustment: 0,
    aiReasoning: 'Multiple reports of waterborne diseases and skin infections over the past 2 weeks. No camp in 8 months. High vulnerability — no clean water source, and the nearest PHC is 15km away. Immediate intervention recommended.',
    lastCampDate: Timestamp.fromDate(new Date('2025-08-15')),
    totalCamps: 2,
    population: 4200,
    vulnerabilityIndex: 0.78,
    issues: ['waterborne disease', 'skin infections', 'malnutrition', 'no clean water'],
  },
  {
    name: 'Koraput Block',
    district: 'Koraput',
    state: 'Odisha',
    coordinates: { lat: 18.81, lng: 82.71 },
    urgencyScore: 76,
    urgencyLevel: UrgencyLevel.CRITICAL,
    urgencyBreakdown: { severity: 20, recency: 18, repeatComplaints: 15, serviceGap: 10, vulnerability: 13 },
    baseScore: 76,
    aiAdjustment: 0,
    aiReasoning: 'Severe anemia in pregnant women reported repeatedly. 30+ cases in 2 months. Iron supplements unavailable at local PHC. Tribal area with limited healthcare access.',
    lastCampDate: Timestamp.fromDate(new Date('2025-11-20')),
    totalCamps: 3,
    population: 6800,
    vulnerabilityIndex: 0.85,
    issues: ['maternal anemia', 'malnutrition', 'lack of supplements', 'tribal healthcare gap'],
  },
  {
    name: 'Dharavi Health Post',
    district: 'Mumbai',
    state: 'Maharashtra',
    coordinates: { lat: 19.043, lng: 72.855 },
    urgencyScore: 68,
    urgencyLevel: UrgencyLevel.HIGH,
    urgencyBreakdown: { severity: 18, recency: 16, repeatComplaints: 12, serviceGap: 8, vulnerability: 14 },
    baseScore: 68,
    aiAdjustment: 0,
    aiReasoning: 'TB screening urgently needed — 12 suspected cases from local clinic. High population density increases transmission risk. Previous camp found 4% positivity rate.',
    lastCampDate: Timestamp.fromDate(new Date('2025-12-10')),
    totalCamps: 5,
    population: 35000,
    vulnerabilityIndex: 0.72,
    issues: ['TB screening', 'respiratory illness', 'overcrowding', 'sanitation'],
  },
  {
    name: 'Jhabua Town',
    district: 'Jhabua',
    state: 'Madhya Pradesh',
    coordinates: { lat: 22.77, lng: 74.59 },
    urgencyScore: 55,
    urgencyLevel: UrgencyLevel.HIGH,
    urgencyBreakdown: { severity: 14, recency: 12, repeatComplaints: 10, serviceGap: 10, vulnerability: 9 },
    baseScore: 55,
    aiAdjustment: 0,
    aiReasoning: 'Eye and dental problems reported by Anganwadi workers. Cataract screening needed for elderly. Moderate vulnerability — some healthcare access exists but specialist gap.',
    lastCampDate: Timestamp.fromDate(new Date('2025-10-05')),
    totalCamps: 4,
    population: 12000,
    vulnerabilityIndex: 0.55,
    issues: ['eye disease', 'dental', 'cataract', 'elderly care'],
  },
  {
    name: 'Sundarbans Island',
    district: 'South 24 Parganas',
    state: 'West Bengal',
    coordinates: { lat: 21.95, lng: 88.87 },
    urgencyScore: 45,
    urgencyLevel: UrgencyLevel.MEDIUM,
    urgencyBreakdown: { severity: 10, recency: 10, repeatComplaints: 8, serviceGap: 8, vulnerability: 9 },
    baseScore: 45,
    aiAdjustment: 0,
    aiReasoning: 'Seasonal diarrhea and fever cases after monsoon flooding. Access challenges — boat-only transport. Community health workers report rising case load.',
    lastCampDate: Timestamp.fromDate(new Date('2026-01-20')),
    totalCamps: 2,
    population: 3500,
    vulnerabilityIndex: 0.65,
    issues: ['seasonal diarrhea', 'fever', 'flood aftermath', 'access challenges'],
  },
  {
    name: 'Anantapur Rural',
    district: 'Anantapur',
    state: 'Andhra Pradesh',
    coordinates: { lat: 14.68, lng: 77.6 },
    urgencyScore: 32,
    urgencyLevel: UrgencyLevel.LOW,
    urgencyBreakdown: { severity: 8, recency: 6, repeatComplaints: 5, serviceGap: 5, vulnerability: 8 },
    baseScore: 32,
    aiAdjustment: 0,
    aiReasoning: 'Minor health issues — cold, cough, routine checkups needed. Recent camp addressed major concerns. Follow-up visits recommended but not urgent.',
    lastCampDate: Timestamp.fromDate(new Date('2026-03-01')),
    totalCamps: 6,
    population: 8500,
    vulnerabilityIndex: 0.4,
    issues: ['routine checkup', 'cold and cough', 'follow-up visits'],
  },
];

// ---- Volunteers ----
export const seedVolunteers = [
  { displayName: 'Dr. Priya Sharma', role: UserRole.DOCTOR, skills: ['General Medicine', 'Pediatrics', 'Triage'], certifications: ['MBBS', 'MD Pediatrics'], languages: ['Hindi', 'English'], availability: 'AVAILABLE' as const, preferredAreas: ['Uttar Pradesh', 'Madhya Pradesh'], travelRadiusKm: 100, completedCamps: 12, rating: 4.8, userId: 'vol_001' },
  { displayName: 'Dr. Ravi Kumar', role: UserRole.DOCTOR, skills: ['Dermatology', 'General Medicine'], certifications: ['MBBS', 'MD Dermatology'], languages: ['Hindi', 'English', 'Telugu'], availability: 'AVAILABLE' as const, preferredAreas: ['Maharashtra', 'Andhra Pradesh'], travelRadiusKm: 200, completedCamps: 8, rating: 4.6, userId: 'vol_002' },
  { displayName: 'Dr. Anita Patel', role: UserRole.DOCTOR, skills: ['Ophthalmology', 'General Medicine'], certifications: ['MBBS', 'MS Ophthalmology'], languages: ['Hindi', 'Gujarati', 'English'], availability: 'BUSY' as const, preferredAreas: ['Madhya Pradesh', 'Gujarat'], travelRadiusKm: 150, completedCamps: 15, rating: 4.9, userId: 'vol_003' },
  { displayName: 'Dr. Suresh Nair', role: UserRole.DOCTOR, skills: ['Pulmonology', 'TB Screening', 'General Medicine'], certifications: ['MBBS', 'MD Pulmonology'], languages: ['Hindi', 'Malayalam', 'English'], availability: 'AVAILABLE' as const, preferredAreas: ['Maharashtra', 'West Bengal'], travelRadiusKm: 300, completedCamps: 20, rating: 4.7, userId: 'vol_004' },
  { displayName: 'Pharm. Deepa Reddy', role: UserRole.PHARMACIST, skills: ['Dispensing', 'Inventory Management', 'Patient Counseling'], certifications: ['B.Pharm', 'D.Pharm'], languages: ['Telugu', 'Hindi', 'English'], availability: 'AVAILABLE' as const, preferredAreas: ['Andhra Pradesh', 'Odisha'], travelRadiusKm: 120, completedCamps: 10, rating: 4.5, userId: 'vol_005' },
  { displayName: 'Pharm. Arjun Singh', role: UserRole.PHARMACIST, skills: ['Dispensing', 'Stock Management'], certifications: ['B.Pharm'], languages: ['Hindi', 'Punjabi'], availability: 'AVAILABLE' as const, preferredAreas: ['Uttar Pradesh'], travelRadiusKm: 80, completedCamps: 6, rating: 4.3, userId: 'vol_006' },
  { displayName: 'Meera Devi', role: UserRole.FIELD_VOLUNTEER, skills: ['Survey', 'Data Collection', 'Community Engagement'], certifications: ['ASHA Training'], languages: ['Hindi', 'Bhojpuri'], availability: 'AVAILABLE' as const, preferredAreas: ['Uttar Pradesh', 'Bihar'], travelRadiusKm: 50, completedCamps: 18, rating: 4.7, userId: 'vol_007' },
  { displayName: 'Rajesh Munda', role: UserRole.FIELD_VOLUNTEER, skills: ['Survey', 'Translation', 'Community Mobilization'], certifications: ['CHW Training'], languages: ['Odia', 'Hindi', 'Kui'], availability: 'AVAILABLE' as const, preferredAreas: ['Odisha'], travelRadiusKm: 40, completedCamps: 14, rating: 4.6, userId: 'vol_008' },
  { displayName: 'Fatima Sheikh', role: UserRole.SUPPORT, skills: ['Registration', 'Crowd Management', 'First Aid'], certifications: ['Red Cross First Aid'], languages: ['Hindi', 'Urdu', 'Marathi'], availability: 'AVAILABLE' as const, preferredAreas: ['Maharashtra'], travelRadiusKm: 30, completedCamps: 22, rating: 4.8, userId: 'vol_009' },
  { displayName: 'Lakshmi B.', role: UserRole.SUPPORT, skills: ['Translation', 'Patient Guidance', 'Follow-up Calls'], certifications: [], languages: ['Kannada', 'Telugu', 'Hindi', 'English'], availability: 'AVAILABLE' as const, preferredAreas: ['Andhra Pradesh', 'Karnataka'], travelRadiusKm: 60, completedCamps: 9, rating: 4.4, userId: 'vol_010' },
  { displayName: 'Amit Verma', role: UserRole.SUPPORT, skills: ['Registration', 'Data Entry', 'Logistics'], certifications: [], languages: ['Hindi', 'English'], availability: 'AVAILABLE' as const, preferredAreas: ['Uttar Pradesh', 'Madhya Pradesh'], travelRadiusKm: 100, completedCamps: 7, rating: 4.2, userId: 'vol_011' },
  { displayName: 'Dr. Sunita Rao', role: UserRole.DOCTOR, skills: ['Gynecology', 'Maternal Health', 'General Medicine'], certifications: ['MBBS', 'DGO'], languages: ['Telugu', 'Hindi', 'English'], availability: 'AVAILABLE' as const, preferredAreas: ['Odisha', 'Andhra Pradesh'], travelRadiusKm: 150, completedCamps: 11, rating: 4.6, userId: 'vol_012' },
  { displayName: 'Sanjay Tribal HW', role: UserRole.FIELD_VOLUNTEER, skills: ['Community Health', 'Tribal Outreach', 'Traditional Medicine Knowledge'], certifications: ['Tribal HW Certificate'], languages: ['Gondi', 'Hindi'], availability: 'AVAILABLE' as const, preferredAreas: ['Madhya Pradesh', 'Chhattisgarh'], travelRadiusKm: 30, completedCamps: 25, rating: 4.9, userId: 'vol_013' },
  { displayName: 'Pharm. Nisha Gupta', role: UserRole.PHARMACIST, skills: ['Dispensing', 'Essential Medicines', 'Record Keeping'], certifications: ['D.Pharm'], languages: ['Hindi', 'Bengali'], availability: 'ON_LEAVE' as const, preferredAreas: ['West Bengal'], travelRadiusKm: 60, completedCamps: 5, rating: 4.1, userId: 'vol_014' },
  { displayName: 'Kavitha R.', role: UserRole.SUPPORT, skills: ['Nursing Assist', 'Triage Support', 'Vital Signs'], certifications: ['ANM'], languages: ['Tamil', 'Hindi', 'English'], availability: 'AVAILABLE' as const, preferredAreas: ['Maharashtra', 'Andhra Pradesh'], travelRadiusKm: 100, completedCamps: 16, rating: 4.7, userId: 'vol_015' },
];

const demoLocalityIndex: Record<string, (typeof seedLocalities)[number]> = Object.fromEntries(
  seedLocalities.map((locality) => [locality.name, locality])
) as Record<string, (typeof seedLocalities)[number]>;

function toLocalityId(name: string): string {
  return `loc_${name.toLowerCase().replace(/\s+/g, '_')}`;
}

function toPseudoGeohash(lat: number, lng: number) {
  return `${lat.toFixed(3)}:${lng.toFixed(3)}`;
}

function inferAffectedEstimate(rawText: string): number {
  const match = rawText.match(/(\d+)\+?/);
  return match ? Number(match[1]) : 25;
}

function inferSeverity(rawText: string): 1 | 2 | 3 | 4 | 5 {
  const normalized = rawText.toLowerCase();

  if (
    normalized.includes('died') ||
    normalized.includes('death') ||
    normalized.includes('hospitalized') ||
    normalized.includes('extremely high')
  ) {
    return 5;
  }

  if (
    normalized.includes('urgent') ||
    normalized.includes('severe') ||
    normalized.includes('spiked') ||
    normalized.includes('completely out of stock')
  ) {
    return 4;
  }

  if (normalized.includes('worried') || normalized.includes('follow-up')) {
    return 3;
  }

  if (normalized.includes('routine')) {
    return 2;
  }

  return 3;
}

function buildUrgencySignals(rawText: string): ExtractedSignal['urgencySignals'] {
  const normalized = rawText.toLowerCase();
  const signals: ExtractedSignal['urgencySignals'] = [];

  if (normalized.includes('died') || normalized.includes('death')) {
    signals.push({ type: 'death', evidenceSpan: rawText.slice(0, 160), confidence: 0.96 });
  }
  if (normalized.includes('hospitalized')) {
    signals.push({ type: 'hospitalization', evidenceSpan: rawText.slice(0, 160), confidence: 0.92 });
  }
  if (
    normalized.includes('tb') ||
    normalized.includes('malaria') ||
    normalized.includes('waterborne') ||
    normalized.includes('diarrhea')
  ) {
    signals.push({ type: 'outbreak', evidenceSpan: rawText.slice(0, 160), confidence: 0.88 });
  }
  if (normalized.includes('out of stock') || normalized.includes('supplements completely out of stock')) {
    signals.push({ type: 'supply_stockout', evidenceSpan: rawText.slice(0, 160), confidence: 0.9 });
  }
  if (normalized.includes('boat-only') || normalized.includes('traveling 25km') || normalized.includes('access')) {
    signals.push({ type: 'access_blocked', evidenceSpan: rawText.slice(0, 160), confidence: 0.82 });
  }
  if (
    normalized.includes('pregnant women') ||
    normalized.includes('children') ||
    normalized.includes('elderly')
  ) {
    signals.push({ type: 'vulnerable_group', evidenceSpan: rawText.slice(0, 160), confidence: 0.86 });
  }

  return signals;
}

function buildNeeds(localityName: string, rawText: string): ExtractedSignal['needs'] {
  const locality = demoLocalityIndex[localityName];
  const issues = locality?.issues?.slice(0, 3) ?? ['general medical need'];
  const severity = inferSeverity(rawText);
  const affectedEstimate = inferAffectedEstimate(rawText);

  return issues.map((issue, index) => ({
    taxonomyCode: issue.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
    label: issue,
    severity,
    affectedEstimate: Math.max(affectedEstimate - index * 5, 5),
    evidenceSpan: rawText.slice(0, 180),
    confidence: Math.max(0.65, 0.92 - index * 0.08),
  }));
}

// ---- Raw Reports ----
export const seedReports = [
  { rawText: "Visited Rampur village on 3rd April. Saw many children with skin rashes and diarrhea. Clean water not available. At least 50 families affected. Need dermatologist and pediatrician urgently. Last camp was over 8 months ago and nothing was done about the water problem.", source: 'field_note' as const, locality: 'Rampur Village', status: ReportStatus.EXTRACTED },
  { rawText: "Anganwadi worker from Koraput block reports severe anemia in pregnant women. About 30 cases identified in last 2 months. Iron and folic acid supplements completely out of stock at local PHC. Women are traveling 25km to get basic supplements. Community very worried about upcoming deliveries.", source: 'survey' as const, locality: 'Koraput Block', status: ReportStatus.EXTRACTED },
  { rawText: "Follow up note from Dharavi health post: TB screening camp needed urgently. 12 suspected cases reported by local private clinic. Previous camp in December screened 200 people and found 8 positive cases. Area has extremely high population density. Community health workers say more people are coughing.", source: 'field_note' as const, locality: 'Dharavi Health Post', status: ReportStatus.EXTRACTED },
  { rawText: "Jhabua Anganwadi report: Many elderly people complaining of poor vision. At least 20 people might have cataracts. Also kids with dental cavities — school principal reports most children have never seen a dentist. Need eye and dental specialists for next camp.", source: 'survey' as const, locality: 'Jhabua Town', status: ReportStatus.EXTRACTED },
  { rawText: "Sundarbans post-flood assessment: After October flooding, diarrhea cases have spiked. At least 40 households reporting illness. Clean water tablets distributed last month are finished. Access is boat-only, making regular medical visits impossible. Need ORS, water purification, and general medical camp.", source: 'field_note' as const, locality: 'Sundarbans Island', status: ReportStatus.EXTRACTED },
  { rawText: "Rampur follow-up visit April 7: Situation getting worse. Two children hospitalized in district hospital for severe dehydration. Hand pump still contaminated. Village head is requesting immediate intervention. Estimate 200+ people need basic health screening.", source: 'field_note' as const, locality: 'Rampur Village', status: ReportStatus.EXTRACTED },
  { rawText: "Koraput tribal area survey update: Beyond anemia, found several cases of sickle cell trait in the community. Need genetic counseling and screening setup. Also reporting high rates of malaria — 15 confirmed cases this month from area CHC records.", source: 'survey' as const, locality: 'Koraput Block', status: ReportStatus.EXTRACTED },
  { rawText: "Routine check Anantapur: Standard seasonal cold and cough. No major issues. Recent camp covered most concerns. Some patients need follow-up for diabetes monitoring. 12 people on medication need refill prescriptions.", source: 'field_note' as const, locality: 'Anantapur Rural', status: ReportStatus.EXTRACTED },
  { rawText: "Dharavi update from community volunteer: One of the TB suspects died last week, family says he never got tested. Community is panicking. Local MLA office requesting NGO intervention. Media might cover this — we need to act fast.", source: 'field_note' as const, locality: 'Dharavi Health Post', status: ReportStatus.EXTRACTED },
  { rawText: "Monthly report from Sundarbans CHW: Snake bite cases increasing as water recedes. Two serious cases evacuated by boat. Also seeing skin fungal infections spreading. Monsoon-related issues likely to continue for 2 more months.", source: 'paste' as const, locality: 'Sundarbans Island', status: ReportStatus.EXTRACTED },
];

export const seedExtractedSignals: ExtractedSignal[] = seedReports.map((report, index) => {
  const locality = report.locality ? demoLocalityIndex[report.locality] : undefined;

  return {
    reportId: `report_${String(index + 1).padStart(3, '0')}`,
    locality: {
      canonicalId: report.locality ? toLocalityId(report.locality) : null,
      rawName: report.locality ?? 'Unknown locality',
      confidence: locality ? 0.96 : 0.5,
    },
    needs: buildNeeds(report.locality ?? '', report.rawText),
    urgencySignals: buildUrgencySignals(report.rawText),
    geo: {
      lat: locality?.coordinates.lat ?? null,
      lng: locality?.coordinates.lng ?? null,
      geohash: null,
      source: 'report_text',
    },
    model: {
      provider: 'vertex-ai',
      name: 'seeded-demo',
      version: 'seed-v1',
      promptVersion: 'seed-v1',
    },
  };
});

// ---- Camp Plans ----
export const seedCampPlans = [
  {
    localityId: 'loc_rampur',
    localityName: 'Rampur Village',
    title: 'Rampur Emergency Health & Water Safety Camp',
    scheduledDate: Timestamp.fromDate(new Date('2026-04-20')),
    status: CampStatus.PLANNED,
    predictedTurnout: 180,
    requiredRoles: { doctors: 3, pharmacists: 2, fieldVolunteers: 3, support: 4 },
    assignedStaff: ['vol_001', 'vol_002', 'vol_006', 'vol_007', 'vol_011'],
    coordinatorId: '',
    notes: 'High priority — focus on waterborne diseases, skin infections, and pediatric cases. Arrange water testing kits.',
    createdAt: Timestamp.fromDate(new Date('2026-04-08')),
  },
  {
    localityId: 'loc_anantapur',
    localityName: 'Anantapur Rural',
    title: 'Anantapur Follow-up & Diabetes Monitoring Camp',
    scheduledDate: Timestamp.fromDate(new Date('2026-03-15')),
    status: CampStatus.COMPLETED,
    predictedTurnout: 120,
    requiredRoles: { doctors: 2, pharmacists: 1, fieldVolunteers: 2, support: 3 },
    assignedStaff: ['vol_002', 'vol_005', 'vol_010', 'vol_012'],
    coordinatorId: '',
    notes: 'Routine camp — focus on diabetes follow-ups and prescription refills.',
    createdAt: Timestamp.fromDate(new Date('2026-03-01')),
    summary: 'Served 98 patients. 15 diabetes follow-ups completed. 12 prescription refills. 3 new referrals to district hospital.',
  }
];

export const seedVolunteerPresence: VolunteerPresence[] = [
  {
    uid: 'vol_001',
    geohash: toPseudoGeohash(26.805, 81.028),
    lat: 26.805,
    lng: 81.028,
    lastSeenAt: Timestamp.fromDate(new Date('2026-04-28T09:10:00+05:30')),
    batteryLevel: 76,
    networkClass: '4g',
    activeCampId: 'camp_planned',
  },
  {
    uid: 'vol_006',
    geohash: toPseudoGeohash(26.792, 81.041),
    lat: 26.792,
    lng: 81.041,
    lastSeenAt: Timestamp.fromDate(new Date('2026-04-28T09:08:00+05:30')),
    batteryLevel: 18,
    networkClass: '3g',
    activeCampId: 'camp_planned',
  },
  {
    uid: 'vol_008',
    geohash: toPseudoGeohash(18.817, 82.703),
    lat: 18.817,
    lng: 82.703,
    lastSeenAt: Timestamp.fromDate(new Date('2026-04-28T08:56:00+05:30')),
    batteryLevel: 62,
    networkClass: 'offline',
    activeCampId: null,
  },
  {
    uid: 'vol_004',
    geohash: toPseudoGeohash(19.046, 72.861),
    lat: 19.046,
    lng: 72.861,
    lastSeenAt: Timestamp.fromDate(new Date('2026-04-28T09:03:00+05:30')),
    batteryLevel: 58,
    networkClass: '4g',
    activeCampId: null,
  },
  {
    uid: 'vol_015',
    geohash: toPseudoGeohash(14.691, 77.608),
    lat: 14.691,
    lng: 77.608,
    lastSeenAt: Timestamp.fromDate(new Date('2026-04-28T08:49:00+05:30')),
    batteryLevel: 84,
    networkClass: '2g',
    activeCampId: null,
  },
];

// ---- Patient Visits ----
export const seedPatientVisits = [
  { campId: 'camp_completed', patientName: 'Anjali Devi', age: 45, gender: 'F' as const, stage: VisitStage.COMPLETED, chiefComplaint: 'Diabetes follow-up, vision blurring', triagePriority: UrgencyLevel.MEDIUM, prescriptions: ['Metformin 500mg', 'Eye drops'], referralNeeded: false, followupNeeded: true },
  { campId: 'camp_completed', patientName: 'Ramesh Kumar', age: 62, gender: 'M' as const, stage: VisitStage.COMPLETED, chiefComplaint: 'Hypertension checkup', triagePriority: UrgencyLevel.LOW, prescriptions: ['Amlodipine 5mg'], referralNeeded: false, followupNeeded: true },
  { campId: 'camp_completed', patientName: 'Sarita Bai', age: 28, gender: 'F' as const, stage: VisitStage.COMPLETED, chiefComplaint: 'Persistent cough, chest pain', triagePriority: UrgencyLevel.HIGH, prescriptions: [], referralNeeded: true, followupNeeded: true },
  { campId: 'camp_completed', patientName: 'Govind Prasad', age: 7, gender: 'M' as const, stage: VisitStage.COMPLETED, chiefComplaint: 'Skin rash, itching', triagePriority: UrgencyLevel.LOW, prescriptions: ['Calamine lotion', 'Cetirizine syrup'], referralNeeded: false, followupNeeded: false },
  { campId: 'camp_planned', patientName: 'Rekha Sharma', age: 35, gender: 'F' as const, stage: VisitStage.REGISTERED, chiefComplaint: 'Severe abdominal pain for 3 days', triagePriority: UrgencyLevel.HIGH, prescriptions: [], referralNeeded: false, followupNeeded: false },
  { campId: 'camp_planned', patientName: 'Mohammad Ali', age: 55, gender: 'M' as const, stage: VisitStage.REGISTERED, chiefComplaint: 'Difficulty breathing, chronic cough', triagePriority: UrgencyLevel.CRITICAL, prescriptions: [], referralNeeded: false, followupNeeded: false },
  { campId: 'camp_planned', patientName: 'Sunita Devi', age: 42, gender: 'F' as const, stage: VisitStage.TRIAGED, chiefComplaint: 'Boils and skin infection', triagePriority: UrgencyLevel.MEDIUM, prescriptions: [], referralNeeded: false, followupNeeded: false },
  { campId: 'camp_planned', patientName: 'Raju', age: 5, gender: 'M' as const, stage: VisitStage.TRIAGED, chiefComplaint: 'Diarrhea and vomiting since 2 days', triagePriority: UrgencyLevel.HIGH, prescriptions: [], referralNeeded: false, followupNeeded: false },
  { campId: 'camp_planned', patientName: 'Kamla Bai', age: 68, gender: 'F' as const, stage: VisitStage.IN_CONSULTATION, chiefComplaint: 'Joint pain, difficulty walking', triagePriority: UrgencyLevel.MEDIUM, prescriptions: [], referralNeeded: false, followupNeeded: false },
  { campId: 'camp_planned', patientName: 'Pappu Singh', age: 30, gender: 'M' as const, stage: VisitStage.IN_CONSULTATION, chiefComplaint: 'Eye redness and watering', triagePriority: UrgencyLevel.LOW, prescriptions: [], referralNeeded: false, followupNeeded: false },
  { campId: 'camp_planned', patientName: 'Geeta Devi', age: 25, gender: 'F' as const, stage: VisitStage.AT_PHARMACY, chiefComplaint: 'Fever and headache', triagePriority: UrgencyLevel.LOW, prescriptions: ['Paracetamol 500mg', 'ORS'], referralNeeded: false, followupNeeded: false },
  { campId: 'camp_planned', patientName: 'Babu Lal', age: 50, gender: 'M' as const, stage: VisitStage.AT_PHARMACY, chiefComplaint: 'Chronic cough', triagePriority: UrgencyLevel.MEDIUM, prescriptions: ['Cough syrup', 'Azithromycin'], referralNeeded: true, followupNeeded: true },
];

// ---- Medicine Stock ----
export const seedMedicineStock = [
  { campId: 'camp_planned', medicineName: 'Paracetamol 500mg', category: 'Analgesic', quantityAvailable: 500, quantityDispensed: 0, unit: 'tablets', expiryDate: Timestamp.fromDate(new Date('2027-06-01')) },
  { campId: 'camp_planned', medicineName: 'Oral Rehydration Salts', category: 'Rehydration', quantityAvailable: 200, quantityDispensed: 0, unit: 'sachets', expiryDate: Timestamp.fromDate(new Date('2027-03-01')) },
  { campId: 'camp_planned', medicineName: 'Amoxicillin 250mg', category: 'Antibiotic', quantityAvailable: 300, quantityDispensed: 0, unit: 'capsules', expiryDate: Timestamp.fromDate(new Date('2027-01-01')) },
  { campId: 'camp_planned', medicineName: 'Cetirizine 10mg', category: 'Antihistamine', quantityAvailable: 200, quantityDispensed: 0, unit: 'tablets', expiryDate: Timestamp.fromDate(new Date('2027-08-01')) },
  { campId: 'camp_planned', medicineName: 'Metformin 500mg', category: 'Antidiabetic', quantityAvailable: 100, quantityDispensed: 0, unit: 'tablets', expiryDate: Timestamp.fromDate(new Date('2027-05-01')) },
  { campId: 'camp_planned', medicineName: 'Amlodipine 5mg', category: 'Antihypertensive', quantityAvailable: 100, quantityDispensed: 0, unit: 'tablets', expiryDate: Timestamp.fromDate(new Date('2027-04-01')) },
  { campId: 'camp_planned', medicineName: 'Calamine Lotion', category: 'Dermatological', quantityAvailable: 50, quantityDispensed: 0, unit: 'bottles', expiryDate: Timestamp.fromDate(new Date('2027-12-01')) },
  { campId: 'camp_planned', medicineName: 'Iron + Folic Acid', category: 'Supplement', quantityAvailable: 300, quantityDispensed: 0, unit: 'tablets', expiryDate: Timestamp.fromDate(new Date('2027-07-01')) },
  { campId: 'camp_planned', medicineName: 'Azithromycin 500mg', category: 'Antibiotic', quantityAvailable: 100, quantityDispensed: 0, unit: 'tablets', expiryDate: Timestamp.fromDate(new Date('2027-02-01')) },
  { campId: 'camp_planned', medicineName: 'Cough Syrup (Dextromethorphan)', category: 'Antitussive', quantityAvailable: 40, quantityDispensed: 0, unit: 'bottles', expiryDate: Timestamp.fromDate(new Date('2027-09-01')) },
  { campId: 'camp_planned', medicineName: 'Permethrin Cream', category: 'Antiparasitic', quantityAvailable: 30, quantityDispensed: 0, unit: 'tubes', expiryDate: Timestamp.fromDate(new Date('2027-10-01')) },
  { campId: 'camp_planned', medicineName: 'Chloroquine Phosphate', category: 'Antimalarial', quantityAvailable: 80, quantityDispensed: 0, unit: 'tablets', expiryDate: Timestamp.fromDate(new Date('2027-06-01')) },
];
