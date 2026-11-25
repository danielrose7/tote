import { commandRoute } from '@/lib/commands/http';
import { transferOwnershipCommand } from '@/lib/commands/team/server';

export const POST = commandRoute(transferOwnershipCommand, {
  target: ({ id }: { id: string }) => ({ collectionId: id }),
});
