export type CsvCell = string | number | boolean | null | undefined | Date;

function escapeCell(cell: CsvCell): string {
  if (cell === null || cell === undefined) return "";
  const raw = cell instanceof Date ? cell.toISOString() : String(cell);
  const value =
    typeof cell === "string" && /^[\t\r\n ]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: CsvCell[][]): string {
  return rows.map((row) => row.map(escapeCell).join(",")).join("\r\n");
}
