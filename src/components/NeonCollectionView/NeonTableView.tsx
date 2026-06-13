'use client';

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import type { CollectionNode } from '../../db/schema';
import tableStyles from '../CollectionView/TableView.module.css';

type NodeProperties = {
  url?: string;
  imageUrl?: string;
  price?: string | number;
};

function propertiesFor(node: CollectionNode): NodeProperties {
  return node.properties as NodeProperties;
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

function formatPrice(price: string | number): string {
  const num = typeof price === 'number' ? price : parseFloat(String(price));
  if (isNaN(num)) return String(price);
  return `$${num.toFixed(2)}`;
}

const columnHelper = createColumnHelper<CollectionNode>();

interface NeonTableViewProps {
  nodes: CollectionNode[];
  allNodes: CollectionNode[];
  onEdit?: (node: CollectionNode) => void;
  onDelete?: (node: CollectionNode) => void;
}

export function NeonTableView({
  nodes,
  allNodes,
  onEdit,
  onDelete,
}: NeonTableViewProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const sectionMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of allNodes) {
      if (n.type === 'section') map.set(n.id, n.title || 'Untitled section');
    }
    return map;
  }, [allNodes]);

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'image',
        header: '',
        size: 60,
        cell: (info) => {
          const props = propertiesFor(info.row.original);
          return (
            <div className={tableStyles.imageCell}>
              {props.imageUrl ? (
                <img
                  src={props.imageUrl}
                  alt=""
                  className={tableStyles.thumbnail}
                  loading="lazy"
                />
              ) : (
                <div className={tableStyles.thumbnailPlaceholder}>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
              )}
            </div>
          );
        },
      }),

      columnHelper.accessor('title', {
        header: 'Title',
        size: 300,
        cell: (info) => {
          const node = info.row.original;
          const title = info.getValue() || 'Untitled';
          const url = propertiesFor(node).url;
          return url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={tableStyles.titleLink}
              title={url}
            >
              {title}
            </a>
          ) : (
            <span className={tableStyles.titleLink}>{title}</span>
          );
        },
      }),

      columnHelper.display({
        id: 'price',
        header: 'Price',
        size: 100,
        cell: (info) => {
          const price = propertiesFor(info.row.original).price;
          return price !== undefined && price !== null ? (
            <span className={tableStyles.price}>{formatPrice(price)}</span>
          ) : (
            <span className={tableStyles.noValue}>-</span>
          );
        },
      }),

      columnHelper.display({
        id: 'section',
        header: 'Section',
        size: 140,
        cell: (info) => {
          const node = info.row.original;
          const sectionName = node.parentId
            ? (sectionMap.get(node.parentId) ?? null)
            : null;
          return sectionName ? (
            <span className={tableStyles.slotBadge}>{sectionName}</span>
          ) : (
            <span className={tableStyles.noValue}>-</span>
          );
        },
      }),

      columnHelper.accessor('createdAt', {
        header: 'Added',
        size: 120,
        cell: (info) => {
          const date = info.getValue();
          return (
            <span
              className={tableStyles.date}
              title={date instanceof Date ? date.toLocaleDateString() : ''}
            >
              {date instanceof Date ? formatRelativeDate(date) : ''}
            </span>
          );
        },
      }),

      columnHelper.display({
        id: 'actions',
        header: '',
        size: 80,
        cell: (info) => {
          const node = info.row.original;
          return (
            <div className={tableStyles.actions}>
              {onEdit && (
                <button
                  type="button"
                  className={tableStyles.actionButton}
                  onClick={() => onEdit(node)}
                  title="Edit"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  className={`${tableStyles.actionButton} ${tableStyles.deleteButton}`}
                  onClick={() => onDelete(node)}
                  title="Delete"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              )}
            </div>
          );
        },
      }),
    ],
    [onEdit, onDelete, sectionMap],
  );

  const table = useReactTable({
    data: nodes,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className={tableStyles.tableWrapper}>
      <table className={tableStyles.table}>
        <thead className={tableStyles.thead}>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className={tableStyles.th}
                  style={{ width: header.getSize() }}
                  onClick={
                    header.column.getCanSort()
                      ? header.column.getToggleSortingHandler()
                      : undefined
                  }
                  data-sortable={header.column.getCanSort()}
                >
                  {header.isPlaceholder ? null : (
                    <div className={tableStyles.headerContent}>
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      {header.column.getCanSort() && (
                        <span className={tableStyles.sortIndicator}>
                          {{
                            asc: ' ↑',
                            desc: ' ↓',
                          }[header.column.getIsSorted() as string] ?? ''}
                        </span>
                      )}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className={tableStyles.tbody}>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className={tableStyles.tr}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className={tableStyles.td}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
