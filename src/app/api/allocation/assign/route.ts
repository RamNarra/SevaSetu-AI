import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const { campId, volunteerId, role, matchScore, matchReasoning } = await request.json();

    if (!campId || !volunteerId) {
      return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
    }

    const assignmentRef = adminDb.collection('assignments').doc();
    const volunteerRef = adminDb.collection('volunteer_profiles').where('userId', '==', volunteerId).limit(1);
    const campRef = adminDb.collection('camp_plans').doc(campId);
    
    // Transactional Assignment
    await adminDb.runTransaction(async (t) => {
      const campSnap = await t.get(campRef);
      if (!campSnap.exists) throw new Error('Camp not found');
      
      const vSnap = await t.get(volunteerRef);
      if (vSnap.empty) throw new Error('Volunteer not found');
      
      const vDoc = vSnap.docs[0];
      const vData = vDoc.data();
      
      if (vData.availability !== 'AVAILABLE') {
        throw new Error('Volunteer is no longer available');
      }
      
      const campData = campSnap.data()!;
      if (campData.assignedStaff?.includes(volunteerId)) {
        throw new Error('Volunteer already assigned to this camp');
      }

      // Create Assignment Document
      const newAssignment = {
        campId,
        volunteerId,
        volunteerName: vData.displayName,
        role: role || vData.role,
        matchScore: matchScore || 100,
        matchReasoning: matchReasoning || 'Manual override',
        confirmed: true,
        assignedAt: FieldValue.serverTimestamp(),
      };
      
      t.set(assignmentRef, newAssignment);
      
      // Update Volunteer
      t.update(vDoc.ref, {
        availability: 'BUSY',
        lastAssigned: FieldValue.serverTimestamp(),
      });
      
      // Update Camp
      t.update(campRef, {
        assignedStaff: FieldValue.arrayUnion(volunteerId),
      });
    });

    return NextResponse.json({ success: true, message: 'Assigned successfully' });
  } catch (error) {
    console.error('Assignment error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
