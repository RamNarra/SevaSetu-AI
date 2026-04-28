import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    console.log('Received Task payload:', payload);

    return NextResponse.json({ success: true, status: 'acknowledged' });
  } catch (error) {
    console.error('Job failure:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
