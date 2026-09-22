import type ExcelJS from "exceljs";

export type SerializableCellValue = string | number | boolean | null;

export interface ParsedCell {
  value: SerializableCellValue;
  formula: string | null;
}

export function toSerializableCell(cell: ExcelJS.Cell): ParsedCell {
  const raw = cell.value;
  if (raw === null || raw === undefined) {
    return { value: null, formula: null };
  }
  if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
    return { value: raw, formula: null };
  }
  if (raw instanceof Date) {
    return { value: raw.toISOString(), formula: null };
  }
  if (typeof raw === "object" && "formula" in raw) {
    const formulaCell = raw as { formula?: unknown; result?: unknown };
    return {
      value: scalarValue(formulaCell.result),
      formula: typeof formulaCell.formula === "string" ? formulaCell.formula : null
    };
  }
  if (typeof raw === "object" && "text" in raw) {
    const textCell = raw as { text?: unknown };
    return { value: typeof textCell.text === "string" ? textCell.text : String(textCell.text ?? ""), formula: null };
  }
  if (typeof raw === "object" && "richText" in raw) {
    const rich = raw as { richText?: Array<{ text?: string }> };
    return { value: rich.richText?.map((part) => part.text ?? "").join("") ?? "", formula: null };
  }
  return { value: String(raw), formula: null };
}

export function scalarValue(value: unknown): SerializableCellValue {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}
