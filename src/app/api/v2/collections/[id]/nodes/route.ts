import { commandRoute } from '@/lib/commands/http';
import { createItemCommand } from '@/lib/commands/items/server';

export const POST = commandRoute(createItemCommand, {
  target: ({ id }: { id: string }) => ({ collectionId: id }),
  created: true,
});
