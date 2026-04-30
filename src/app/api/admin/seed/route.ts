import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { withRoles } from '@/lib/auth/withAuth';
import {
  seedLocalities,
  seedVolunteers,
  seedReports,
  seedExtractedSignals,
  seedCampPlans,
  seedPatientVisits,
  seedMedicineStock,
  seedVolunteerPresence,
} from '@/data/seed';
import { UserRole } from '@/types';

function normalizeFirestoreValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeFirestoreValue);
  }

  if (value && typeof value === 'object') {
    if ('toDate' in value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
      return (value as { toDate: () => Date }).toDate();
    }

    const normalizedEntries = Object.entries(value).map(([key, nestedValue]) => [
      key,
      normalizeFirestoreValue(nestedValue),
    ]);
    return Object.fromEntries(normalizedEntries);
  }

  return value;
}

async function writeBatch(
  operations: Array<{ collection: string; docId: string; data: Record<string, unknown> }>
) {
  const batch = adminDb.batch();

  for (const operation of operations) {
    batch.set(
      adminDb.collection(operation.collection).doc(operation.docId),
      normalizeFirestoreValue(operation.data)
    );
  }

  await batch.commit();
}

export const POST = withRoles([UserRole.COORDINATOR], async (_request: NextRequest, ctx) => {
  try {
    const results: string[] = [];

    await writeBatch([
      {
        collection: 'users',
        docId: ctx.uid,
        data: {
          uid: ctx.uid,
          displayName: ctx.email?.split('@')[0] ?? 'Demo Coordinator',
          email: ctx.email ?? 'demo@sevasetu.ai',
          role: UserRole.COORDINATOR,
          createdAt: new Date(),
        },
      },
    ]);
    results.push('Coordinator profile established');

    const localityOps = seedLocalities.map((loc) => ({
      collection: 'localities',
      docId: `loc_${loc.name.toLowerCase().replace(/\s+/g, '_')}`,
      data: loc as unknown as Record<string, unknown>,
    }));
    await writeBatch(localityOps);
    results.push(`${localityOps.length} localities seeded`);

    const volunteerOps = seedVolunteers.map((volunteer) => ({
      collection: 'volunteer_profiles',
      docId: volunteer.userId,
      data: volunteer as unknown as Record<string, unknown>,
    }));
    await writeBatch(volunteerOps);
    results.push(`${volunteerOps.length} volunteers seeded`);

    const presenceOps = seedVolunteerPresence.map((presence) => ({
      collection: 'volunteer_presence',
      docId: presence.uid,
      data: presence as unknown as Record<string, unknown>,
    }));
    await writeBatch(presenceOps);
    results.push(`${presenceOps.length} live presence markers seeded`);

    const rawReportOps = seedReports.map((report, index) => ({
      collection: 'raw_reports',
      docId: `report_${String(index + 1).padStart(3, '0')}`,
      data: {
        ...report,
        clientEventId: `report_${String(index + 1).padStart(3, '0')}`,
        submittedBy: ctx.uid,
        submitterName: ctx.email ?? 'Demo Coordinator',
        fileUrls: [],
        storageUri: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSyncedAt: new Date(),
      },
    }));
    await writeBatch(rawReportOps);
    results.push(`${rawReportOps.length} raw reports seeded`);

    const extractedOps = seedExtractedSignals.map((signal, index) => ({
      collection: 'extracted_reports',
      docId: `report_${String(index + 1).padStart(3, '0')}`,
      data: {
        ...signal,
        sourceCollection: 'raw_reports',
        createdAt: new Date(),
        processedAt: new Date(),
      },
    }));
    await writeBatch(extractedOps);
    results.push(`${extractedOps.length} extracted signals seeded`);

    const campOps = seedCampPlans.map((camp, index) => ({
      collection: 'camp_plans',
      docId: index === 0 ? 'camp_planned' : 'camp_completed',
      data: {
        ...camp,
        coordinatorId: ctx.uid,
      },
    }));
    await writeBatch(campOps);
    results.push(`${campOps.length} camp plans seeded`);

    const visitOps = seedPatientVisits.map((visit, index) => ({
      collection: 'patient_visits',
      docId: `visit_${String(index + 1).padStart(3, '0')}`,
      data: visit as unknown as Record<string, unknown>,
    }));
    await writeBatch(visitOps);
    results.push(`${visitOps.length} patient visits seeded`);

    const medicineOps = seedMedicineStock.map((medicine, index) => ({
      collection: 'medicine_stock',
      docId: `med_${String(index + 1).padStart(3, '0')}`,
      data: medicine as unknown as Record<string, unknown>,
    }));
    await writeBatch(medicineOps);
    results.push(`${medicineOps.length} medicine stock items seeded`);

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Admin seed failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
});

export const DELETE = withRoles([UserRole.COORDINATOR], async () => {
  try {
    const collections = [
      'localities',
      'volunteer_profiles',
      'volunteer_presence',
      'raw_reports',
      'extracted_reports',
      'outbox_events',
      'camp_plans',
      'patient_visits',
      'medicine_stock',
      'dispense_logs',
      'followups',
    ];

    for (const collectionName of collections) {
      const snapshot = await adminDb.collection(collectionName).get();
      if (snapshot.empty) {
        continue;
      }

      const batch = adminDb.batch();
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin clear failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
});
