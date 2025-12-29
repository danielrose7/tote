import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
} from "@tanstack/react-table";
import type { co } from "jazz-tools";
import type { Block } from "../../schema";
import { getColumns } from "./columns";
import styles from "./TableView.module.css";

type LoadedBlock = co.loaded<typeof Block>;

interface TableViewProps {
  blocks: LoadedBlock[];
  onEdit?: (block: LoadedBlock) => void;
  onDelete?: (block: LoadedBlock) => void;
  onRefresh?: (block: LoadedBlock) => void;
}

export function TableView({
  blocks,
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
    data: blocks,
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
