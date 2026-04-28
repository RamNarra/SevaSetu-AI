import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { assignmentId, medicineId, amountDispensed, dispensedBy } = await req.json();

    if (!assignmentId || !medicineId || !amountDispensed || amountDispensed <= 0) {
      return NextResponse.json({ error: 'Missing or invalid parameters' }, { status: 400 });
    }

    const stockRef = adminDb.collection('medicine_stock').doc(medicineId);
    const auditRef = adminDb.collection('audit_logs').doc();
    const assignmentRef = adminDb.collection('assignments').doc(assignmentId);

    await adminDb.runTransaction(async (transaction) => {
      const stockDoc = await transaction.get(stockRef);
      if (!stockDoc.exists) {
        throw new Error('Medicine stock not found');
      }

      const currentStock = stockDoc.data()?.currentStock || 0;
      if (currentStock < amountDispensed) {
        throw new Error('Insufficient stock for dispense event');
      }

      // Subtract stock
      transaction.update(stockRef, {
        currentStock: currentStock - amountDispensed,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Log to audit trial
      transaction.set(auditRef, {
        assignmentId,
        medicineId,
        medicineName: stockDoc.data()?.name || 'Unknown',
        amountDispensed,
        dispensedBy: dispensedBy || 'System',
        timestamp: FieldValue.serverTimestamp(),
        type: 'DISPENSE',
      });

      // Update the assignment event log
      transaction.update(assignmentRef, {
        eventLog: FieldValue.arrayUnion({
          timestamp: new Date().toISOString(),
          type: 'DISPENSE',
          message: `Dispensed ${amountDispensed} units of ${stockDoc.data()?.name || 'Unknown'}`,
          actor: dispensedBy || 'System'
        })
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Dispense transaction failed:', error);
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
