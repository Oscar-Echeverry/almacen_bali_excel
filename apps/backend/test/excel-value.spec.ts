import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { toSerializableCell } from "../src/excel/excel-value";

describe("excel value parsing", () => {
  it("detects formulas and returns their visible result", () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet");
    sheet.getCell("A1").value = { formula: "B1+C1", result: 7 };
    expect(toSerializableCell(sheet.getCell("A1"))).toEqual({ formula: "B1+C1", value: 7 });
  });

  it("serializes dates and scalar values", () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet");
    const date = new Date("2026-01-01T00:00:00.000Z");
    sheet.getCell("A1").value = date;
    sheet.getCell("B1").value = "text";
    expect(toSerializableCell(sheet.getCell("A1")).value).toBe(date.toISOString());
    expect(toSerializableCell(sheet.getCell("B1")).value).toBe("text");
  });
});
