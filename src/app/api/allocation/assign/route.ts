import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/withAuth';
import { allocationAssignRequestSchema } from '@/lib/ai/requestSchemas';

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = allocationAssignRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const { campId, volunteerId, role, matchScore, matchReasoning } = parsed.data;

    const assignmentRef = adminDb.collection('assignments').doc();
    const volunteerQuery = adminDb
      .collection('volunteer_profiles')
      .where('userId', '==', volunteerId)
      .limit(1);
    const campRef = adminDb.collection('camp_plans').doc(campId);

    let conflict = false;
    await adminDb.runTransaction(async (t) => {
      const campSnap = await t.get(campRef);
      if (!campSnap.exists) throw new Error('Camp not found');

      const vSnap = await t.get(volunteerQuery);
      if (vSnap.empty) throw new Error('Volunteer not found');

      const vDoc = vSnap.docs[0];
      const vData = vDoc.data();

      const availability = vData.availability ?? vData.status ?? 'AVAILABLE';
      if (availability !== 'AVAILABLE') {
        conflict = true;
        throw new Error('Volunteer is no longer available');
      }

      const campData = campSnap.data()!;
      if (Array.isArray(campData.assignedStaff) && campData.assignedStaff.includes(volunteerId)) {
        conflict = true;
        throw new Error('Volunteer already assigned to this camp');
      }

      t.set(assignmentRef, {
        campId,
        volunteerId,
        volunteerName: vData.displayName ?? '',
        role: role || vData.role,
        matchScore: matchScore ?? 100,
        matchReasoning: matchReasoning ?? 'Manual override',
        confirmed: true,
        assignedAt: FieldValue.serverTimestamp(),
      });

      t.update(vDoc.ref, {
        availability: 'BUSY',
        lastAssigned: FieldValue.serverTimestamp(),
      });

      t.update(campRef, {
        assignedStaff: FieldValue.arrayUnion(volunteerId),
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Assigned successfully',
      assignmentId: assignmentRef.id,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal error';
    if (msg.includes('no longer available') || msg.includes('already assigned')) {
      return NextResponse.json({ success: false, error: msg }, { status: 409 });
    }
    console.error('Assignment error:', error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
});
