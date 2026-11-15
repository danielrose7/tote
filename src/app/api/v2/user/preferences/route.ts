import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { LOCALES } from '@/i18n/config';
import { getUserLocale, setUserLocale } from '@/lib/users/repository';

// Per-user settings shared by every surface (web, extension, iOS). Today that
// is just the UI language; add fields here rather than a new endpoint each.

const patchSchema = z.object({
  locale: z.enum(LOCALES),
});

// The web app uses a session token; the extension and iOS app use an API key,
// whose owning user is its `subject`.
async function currentUserId(): Promise<string | null> {
  const { userId } = await auth();
  if (userId) return userId;
  const apiKey = await auth({ acceptsToken: 'api_key' });
  return apiKey.isAuthenticated && apiKey.subject.startsWith('user_')
    ? apiKey.subject
    : null;
}

export async function GET() {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ locale: await getUserLocale(userId) });
}

export async function PATCH(request: Request) {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid preferences', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  await setUserLocale(userId, parsed.data.locale);
  return NextResponse.json({ locale: parsed.data.locale });
}
