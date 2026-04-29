import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Canonical availability transitions.
 *   AVAILABLE → BUSY  (on assignment)
 *   AVAILABLE → DEPLOYED  (on dispatch to active camp)
 *   BUSY → AVAILABLE  (on assignment release)
 *
 * `availability` is the single source of truth. Legacy `status` is migrated
 * away from — never read it new code.
 */
export type CanonicalAvailability = 'AVAILABLE' | 'BUSY' | 'DEPLOYED' | 'ON_LEAVE';

export async function assignVolunteerTransaction(
  volunteerId: string,
  campId: string,
  role: string
) {
  const volunteerRef = adminDb.collection('volunteer_profiles').doc(volunteerId);
  const assignmentRef = adminDb.collection('assignments').doc();
  const campRef = adminDb.collection('camp_plans').doc(campId);

  return await adminDb.runTransaction(async (transaction) => {
    const [volSnap, campSnap] = await Promise.all([
      transaction.get(volunteerRef),
      transaction.get(campRef),
    ]);

    if (!volSnap.exists) throw new Error('Volunteer not found');
    if (!campSnap.exists) throw new Error('Camp not found');

    const data = volSnap.data() ?? {};
    // Migration-safe read: prefer canonical `availability`, fall back to `status`.
    const currentAvailability =
      (data.availability as CanonicalAvailability | undefined) ??
      (data.status as CanonicalAvailability | undefined) ??
      'AVAILABLE';

    if (currentAvailability !== 'AVAILABLE') {
      throw new Error('Volunteer is no longer available');
    }

    const campData = campSnap.data() ?? {};
    const assignedStaff: string[] = Array.isArray(campData.assignedStaff)
      ? campData.assignedStaff
      : [];
    if (assignedStaff.includes(volunteerId)) {
      throw new Error('Volunteer already assigned to this camp');
    }

    transaction.update(volunteerRef, {
      availability: 'DEPLOYED' as CanonicalAvailability,
      activeCampId: campId,
      lastAssigned: FieldValue.serverTimestamp(),
    });

    transaction.update(campRef, {
      assignedStaff: FieldValue.arrayUnion(volunteerId),
    });

    transaction.set(assignmentRef, {
      volunteerId,
      volunteerName: data.displayName ?? '',
      campId,
      role,
      confirmed: true,
      assignedAt: FieldValue.serverTimestamp(),
    });

    return { success: true, assignmentId: assignmentRef.id };
  });
}

/** Release a volunteer back to AVAILABLE — used when an assignment is cancelled. */
export async function releaseVolunteerTransaction(volunteerId: string) {
  const volRef = adminDb.collection('volunteer_profiles').doc(volunteerId);
  return await adminDb.runTransaction(async (t) => {
    const snap = await t.get(volRef);
    if (!snap.exists) throw new Error('Volunteer not found');
    t.update(volRef, {
      availability: 'AVAILABLE' as CanonicalAvailability,
      activeCampId: FieldValue.delete(),
    });
    return { success: true };
  });
}
