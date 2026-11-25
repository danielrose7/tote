import { copyCollectionCommand } from '@/lib/commands/collections/server';
import { commandRoute } from '@/lib/commands/http';

export const POST = commandRoute(copyCollectionCommand, {
  target: ({ id }: { id: string }) => ({ collectionId: id }),
  created: true,
});
