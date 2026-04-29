import { NextRequest, NextResponse } from 'next/server';
import { assignVolunteerTransaction } from '@/lib/db/transactions';
import { withAuth } from '@/lib/auth/withAuth';
import { matchingDispatchRequestSchema } from '@/lib/ai/requestSchemas';

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const parsed = matchingDispatchRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const { volunteerId, campId, role } = parsed.data;
    const result = await assignVolunteerTransaction(volunteerId, campId, role);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Dispatch transaction failed:', error);
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    if (
      msg === 'Volunteer is no longer available' ||
      msg.includes('already assigned')
    ) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
});
