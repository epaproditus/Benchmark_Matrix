import { NextResponse } from 'next/server';
import { requireAccess } from '@/lib/access';

export async function GET() {
  const accessResult = await requireAccess();
  if (accessResult.response) {
    return accessResult.response;
  }

  return NextResponse.json({
    email: accessResult.access.email,
    displayName: accessResult.access.displayName,
    teacherName: accessResult.access.teacherName,
    isAdmin: accessResult.access.isAdmin,
  });
}
