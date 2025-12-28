import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
} from "@tanstack/react-table";
import type { co } from "jazz-tools";
import type { ProductLink } from "../../schema";
import { getColumns } from "./columns";
import styles from "./TableView.module.css";

type LoadedProductLink = co.loaded<typeof ProductLink>;

interface TableViewProps {
  links: LoadedProductLink[];
  onEdit?: (link: LoadedProductLink) => void;
  onDelete?: (link: LoadedProductLink) => void;
  onRefresh?: (link: LoadedProductLink) => void;
}

export function TableView({
  links,
  onEdit,
  onDelete,
  onRefresh,
}: TableViewProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(
    () => getColumns({ onEdit, onDelete, onRefresh }),
    [onEdit, onDelete, onRefresh]
  );

  const table = useReactTable({
    data: links,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead className={styles.thead}>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className={styles.th}
                  style={{ width: header.getSize() }}
                  onClick={
                    header.column.getCanSort()
                      ? header.column.getToggleSortingHandler()
                      : undefined
                  }
                  data-sortable={header.column.getCanSort()}
                >
                  {header.isPlaceholder ? null : (
                    <div className={styles.headerContent}>
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {header.column.getCanSort() && (
                        <span className={styles.sortIndicator}>
                          {{
                            asc: " ↑",
                            desc: " ↓",
                          }[header.column.getIsSorted() as string] ?? ""}
                        </span>
                      )}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className={styles.tbody}>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className={styles.tr}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className={styles.td}>
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
