import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';
import { authConfigured } from './lib/auth-config';

const authenticate = clerkMiddleware({ jwtKey: process.env.CLERK_JWT_KEY });

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  // Keep the public planner usable before credentials have been configured.
  // Account handlers enforce authenticated ownership at the data boundary.
  if (!authConfigured()) return NextResponse.next();
  return authenticate(request, event);
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/(.*)',
  ],
};
