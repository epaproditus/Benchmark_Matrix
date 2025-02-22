import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  console.log(`[${new Date().toISOString()}] ${request.method} ${request.url}`);
  
  if (request.method === 'POST') {
    request.clone().json().then(body => {
      console.log('Request body:', body);
    }).catch(console.error);
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
