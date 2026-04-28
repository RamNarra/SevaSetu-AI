import { NextResponse } from 'next/server';
import { assignVolunteerTransaction } from '@/lib/db/transactions';

export async function POST(req: Request) {
  try {
    const { volunteerId, campId, role } = await req.json();

    if (!volunteerId || !campId || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await assignVolunteerTransaction(volunteerId, campId, role);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Dispatch transaction failed:', error);
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    if (msg === 'Volunteer is no longer available') {
      return NextResponse.json({ error: msg }, { status: 409 }); // Conflict
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
