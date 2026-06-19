import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'The Classic Jazz rollback window has closed.' },
    { status: 410 },
  );
}
