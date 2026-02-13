import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { connectToDatabase } from '@/lib/db';

interface AppUserRow {
  email: string;
  password_hash: string;
  display_name: string | null;
  teacher_name: string | null;
  is_admin: number;
  is_active: number;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      name: 'Email and Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email || '').trim().toLowerCase();
        const password = String(credentials?.password || '');

        if (!email || !password) {
          return null;
        }

        let connection: Awaited<ReturnType<typeof connectToDatabase>> | null = null;
        try {
          connection = await connectToDatabase();
          const [rows] = await connection.execute(
            `
              SELECT email, password_hash, display_name, teacher_name, is_admin, is_active
              FROM app_users
              WHERE LOWER(email) = ?
              LIMIT 1
            `,
            [email],
          );

          const user = Array.isArray(rows) && rows.length > 0 ? (rows[0] as AppUserRow) : null;
          if (!user || user.is_active !== 1) {
            return null;
          }

          const isValidPassword = await bcrypt.compare(password, user.password_hash);
          if (!isValidPassword) {
            return null;
          }

          return {
            id: user.email,
            email: user.email,
            name: user.display_name || user.email,
            isAdmin: user.is_admin === 1,
            teacherName: user.teacher_name,
          };
        } catch (error) {
          console.error('Authentication error:', error);
          return null;
        } finally {
          if (connection) {
            await connection.release();
          }
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.email = user.email;
        token.name = user.name;
        token.isAdmin = Boolean((user as { isAdmin?: boolean }).isAdmin);
        token.teacherName = (user as { teacherName?: string | null }).teacherName ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = String(token.email || '');
        session.user.name = token.name ? String(token.name) : session.user.email;
        session.user.isAdmin = Boolean(token.isAdmin);
        session.user.teacherName = token.teacherName ? String(token.teacherName) : null;
      }
      return session;
    },
  },
});
