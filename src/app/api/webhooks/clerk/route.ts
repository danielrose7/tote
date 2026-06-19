import { clerkClient } from '@clerk/nextjs/server';
import { headers } from 'next/headers';
import { Webhook } from 'svix';
import { markUserDeleted, upsertUser } from '../../../../lib/users/repository';

type ClerkEmailAddress = { email_address: string };

type ClerkUserEvent = {
  type:
    | 'user.created'
    | 'user.updated'
    | 'user.deleted'
    | (string & Record<never, never>);
  data: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    image_url: string;
    email_addresses: ClerkEmailAddress[];
    primary_email_address_id: string | null;
    deleted?: boolean;
  };
};

export async function POST(request: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return new Response('Webhook secret not configured', { status: 500 });
  }

  const payload = await request.text();
  const headersList = await headers();
  const svixHeaders = {
    'svix-id': headersList.get('svix-id') ?? '',
    'svix-timestamp': headersList.get('svix-timestamp') ?? '',
    'svix-signature': headersList.get('svix-signature') ?? '',
  };

  let event: ClerkUserEvent;
  try {
    event = new Webhook(secret).verify(payload, svixHeaders) as ClerkUserEvent;
  } catch {
    return new Response('Invalid signature', { status: 400 });
  }

  const { type, data } = event;

  if (type === 'user.created' || type === 'user.updated') {
    const primaryEmail =
      data.email_addresses.find(
        (e) => (e as { id?: string }).id === data.primary_email_address_id,
      )?.email_address ??
      data.email_addresses[0]?.email_address ??
      null;

    await upsertUser(data.id, {
      firstName: data.first_name,
      lastName: data.last_name,
      imageUrl: data.image_url,
      primaryEmail,
    });

    if (type === 'user.created') {
      const clerk = await clerkClient();
      await clerk.users.updateUserMetadata(data.id, {
        publicMetadata: { neonCollectionsEnabled: true },
      });
    }
  } else if (type === 'user.deleted') {
    await markUserDeleted(data.id);
  }

  return new Response('OK', { status: 200 });
}
