import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';

export interface AccessContext {
  email: string;
  displayName: string | null;
  teacherName: string | null;
  isAdmin: boolean;
}

interface AppUserAccessRow {
  email: string;
  display_name: string | null;
  teacher_name: string | null;
  is_admin: number;
  is_active: number;
}

type AccessRequirementResult =
  | { access: AccessContext; response?: never }
  | { response: NextResponse; access?: never };

interface RequireAccessOptions {
  adminOnly?: boolean;
}

async function lookupAccessByEmail(email: string): Promise<AccessContext | null> {
  let connection: Awaited<ReturnType<typeof connectToDatabase>> | null = null;
  try {
    connection = await connectToDatabase();
    const [rows] = await connection.execute(
      `
        SELECT email, display_name, teacher_name, is_admin, is_active
        FROM app_users
        WHERE LOWER(email) = ?
        LIMIT 1
      `,
      [email.toLowerCase()],
    );

    const user = Array.isArray(rows) && rows.length > 0 ? (rows[0] as AppUserAccessRow) : null;
    if (!user || user.is_active !== 1) {
      return null;
    }

    return {
      email: user.email,
      displayName: user.display_name,
      teacherName: user.teacher_name,
      isAdmin: user.is_admin === 1,
    };
  } finally {
    if (connection) {
      await connection.release();
    }
  }
}

export async function requireAccess(options: RequireAccessOptions = {}): Promise<AccessRequirementResult> {
  const session = await auth();
  const sessionEmail = session?.user?.email?.trim();

  if (!sessionEmail) {
    return {
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const access = await lookupAccessByEmail(sessionEmail);
  if (!access) {
    return {
      response: NextResponse.json({ error: 'No active access mapping found for this user' }, { status: 403 }),
    };
  }

  if (!access.isAdmin && !access.teacherName) {
    return {
      response: NextResponse.json({ error: 'Teacher scope missing for this account' }, { status: 403 }),
    };
  }

  if (options.adminOnly && !access.isAdmin) {
    return {
      response: NextResponse.json({ error: 'Admin privileges required' }, { status: 403 }),
    };
  }

  return { access };
}

export function resolveTeacherScope(access: AccessContext, requestedTeacher?: string | null): string | null {
  if (access.isAdmin) {
    return requestedTeacher?.trim() || null;
  }
  return access.teacherName;
}
