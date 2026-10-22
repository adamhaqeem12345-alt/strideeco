import { handlers, authConfigured } from '../../../../auth';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
const unavailable = () => Response.json({ error: 'Account sign-in has not been configured for this deployment.' }, { status: 503 });
export const GET = (request: NextRequest) => authConfigured() ? handlers.GET(request) : unavailable();
export const POST = (request: NextRequest) => authConfigured() ? handlers.POST(request) : unavailable();
