import { commandRoute } from '@/lib/commands/http';
import { copyPublicationCommand } from '@/lib/commands/publications/server';

export const POST = commandRoute(copyPublicationCommand, {
  target: ({ id }: { id: string }) => ({ publicationId: id }),
  created: true,
});
