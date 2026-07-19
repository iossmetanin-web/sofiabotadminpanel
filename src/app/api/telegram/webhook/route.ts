// /api/telegram/webhook — main Telegram webhook endpoint (Vercel serverless).
//
// Telegram POSTs an Update here. We process it and return 200 fast.
// Vercel allows up to 60s on Pro, 10s on Hobby — we set maxDuration=30.

import { NextRequest, NextResponse } from 'next/server';
import { handleUpdate } from '@/lib/bot/handlers';
import { verifyWebhookSecret } from '@/lib/bot/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  // Optional secret-token verification.
  const secret = req.headers.get('x-telegram-bot-api-secret-token');
  if (!verifyWebhookSecret(secret)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const update = await req.json();
    // Process update (await so Telegram gets 200 only after we are done).
    await handleUpdate(update);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[webhook] error:', e instanceof Error ? e.message : String(e));
    // Still return 200 to prevent Telegram from retrying 100 times.
    return NextResponse.json({ ok: true });
  }
}

// Health check.
export async function GET() {
  return NextResponse.json({ ok: true, service: 'sofia-bot-webhook' });
}
