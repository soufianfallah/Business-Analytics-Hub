import type { ReactNode } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type DataTableColumn<TRow> = {
  id: string;
  header: ReactNode;
  cell: (row: TRow) => ReactNode;
  className?: string;
};

export type DataTableProps<TRow> = {
  data: TRow[];
  columns: DataTableColumn<TRow>[];
  getRowId: (row: TRow) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
};

export function DataTable<TRow>({
  data,
  columns,
  getRowId,
  emptyTitle = "No results",
  emptyDescription = "There is no data to display yet.",
  className,
}: DataTableProps<TRow>) {
  if (data.length === 0)
    return (
      <EmptyState
        className={className}
        title={emptyTitle}
        description={emptyDescription}
        compact
      />
    );
  return (
    <div className={cn("overflow-hidden rounded-lg border bg-card", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead className={column.className} key={column.id}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={getRowId(row)}>
              {columns.map((column) => (
                <TableCell className={column.className} key={column.id}>
                  {column.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
