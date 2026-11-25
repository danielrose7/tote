import { commandRoute } from '@/lib/commands/http';
import { reorderItemsCommand } from '@/lib/commands/items/server';

export const POST = commandRoute(reorderItemsCommand, {
  target: ({ id }: { id: string }) => ({ collectionId: id }),
});
