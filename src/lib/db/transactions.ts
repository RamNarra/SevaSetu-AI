import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function assignVolunteerTransaction(volunteerId: string, campId: string, role: string) {
  const volunteerRef = adminDb.collection('volunteer_profiles').doc(volunteerId);
  const assignmentRef = adminDb.collection('assignments').doc();

  return await adminDb.runTransaction(async (transaction) => {
    const doc = await transaction.get(volunteerRef);
    if (!doc.exists) {
      throw new Error('Volunteer not found');
    }

    const data = doc.data();
    // The instructions say checking 'status', but the actual DB uses 'availability' or 'status'. Check both.
    const currentStatus = data?.status || data?.availability;

    if (currentStatus !== 'AVAILABLE') {
      throw new Error('Volunteer is no longer available');
    }

    transaction.update(volunteerRef, {
      status: 'DEPLOYED',
      availability: 'DEPLOYED', // Update both to be safe against schema changes
      activeCampId: campId
    });

    transaction.set(assignmentRef, {
      volunteerId,
      campId,
      role,
      assignedAt: FieldValue.serverTimestamp()
    });

    return { success: true, assignmentId: assignmentRef.id };
  });
}
