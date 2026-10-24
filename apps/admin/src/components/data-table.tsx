import { tableFeatures, useTable, type ColumnDef, type RowData } from "@tanstack/react-table"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"

export const features = tableFeatures({})

/** 表格 + 服务端分页 */
export function DataTable<T extends RowData>({
  columns,
  data,
  empty,
  loading,
  page,
  pageSize,
  total,
  onPage,
}: {
  columns: ColumnDef<typeof features, T>[]
  data: T[]
  empty: React.ReactNode
  loading?: boolean
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
}) {
  const table = useTable({ features, columns, data })
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader className="bg-muted">
          {table.getHeaderGroups().map((g) => (
            <TableRow key={g.id}>
              {g.headers.map((h) => (
                <TableHead key={h.id} className="text-xs font-medium text-muted-foreground">
                  {h.isPlaceholder ? null : <table.FlexRender header={h} />}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody className={loading ? "opacity-60" : undefined}>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id}>
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-32 text-center text-sm text-muted-foreground">
                {loading ? "加载中…" : empty}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between border-t px-4 py-2 text-sm text-muted-foreground">
        <span className="tabular">
          共 {total} 条 · 第 {page} / {pages} 页
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            上一页
          </Button>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
            下一页
          </Button>
        </div>
      </div>
    </div>
  )
}
