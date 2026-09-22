import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import ExcelJS from "exceljs";

async function main(): Promise<void> {
  const output = resolve(__dirname, "../../../fixtures/test-workbook.xlsx");
  mkdirSync(dirname(output), { recursive: true });
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Secure Spreadsheet Workspace";
  const sheet1 = workbook.addWorksheet("Finanzas");
  sheet1.columns = [
    { header: "Item", key: "item", width: 24 },
    { header: "Cantidad", key: "qty", width: 14 },
    { header: "Precio", key: "price", width: 14 },
    { header: "Total", key: "total", width: 16 },
    { header: "Fecha", key: "date", width: 18 }
  ];
  sheet1.addRow({ item: "Licencias", qty: 2, price: 120, date: new Date("2026-01-12") });
  sheet1.addRow({ item: "Consultoría", qty: 4, price: 300, date: new Date("2026-01-15") });
  sheet1.getCell("D2").value = { formula: "B2*C2", result: 240 };
  sheet1.getCell("D3").value = { formula: "B3*C3", result: 1200 };
  sheet1.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet1.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF176F60" } };
  sheet1.getColumn("C").numFmt = "$#,##0.00";
  sheet1.getColumn("D").numFmt = "$#,##0.00";
  sheet1.getColumn("E").numFmt = "yyyy-mm-dd";

  const sheet2 = workbook.addWorksheet("Inventario");
  sheet2.columns = [
    { header: "Código", key: "code", width: 16 },
    { header: "Descripción", key: "description", width: 28 },
    { header: "Stock", key: "stock", width: 12 },
    { header: "Reorden", key: "reorder", width: 12 }
  ];
  sheet2.addRow({ code: "A-100", description: "Teclados", stock: 30, reorder: 10 });
  sheet2.addRow({ code: "B-200", description: "Monitores", stock: 8, reorder: 12 });
  sheet2.getCell("E2").value = { formula: "C2<D2", result: false };
  sheet2.getCell("E3").value = { formula: "C3<D3", result: true };
  sheet2.getRow(1).font = { bold: true };
  sheet2.getColumn("B").width = 30;

  await workbook.xlsx.writeFile(output);
  process.stdout.write(`Fixture written: ${output}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
