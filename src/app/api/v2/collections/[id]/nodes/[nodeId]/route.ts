import { commandRoute } from '@/lib/commands/http';
import {
  deleteItemCommand,
  updateItemCommand,
} from '@/lib/commands/items/server';

const target = ({ id, nodeId }: { id: string; nodeId: string }) => ({
  collectionId: id,
  nodeId,
});

export const PATCH = commandRoute(updateItemCommand, { target });
export const DELETE = commandRoute(deleteItemCommand, { target });
