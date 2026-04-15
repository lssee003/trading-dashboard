/**
 * sheetsData.ts — Fetch breadth data from Google Sheets
 *
 * Downloads XLSX export to extract per-cell background colors exactly
 * as they appear in the Google Sheet (no guessing, no gradients).
 */

import type { SheetsData, SheetsCell } from '../shared/schema';
import { Buffer } from 'buffer';

const SHEET_ID = '1O6OhS7ciA8zwfycBfGPbP2fWJnR0pn2UUvFZVDP9jpE';
const GID = '1082103394'; // 2026 tab

/* ── CSV parser (for data values — faster than XLSX value parsing) ── */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let cur = '', inQ = false;
  const row: string[] = [];
  const push = () => { rows.push([...row]); row.length = 0; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (c === '"') { if (inQ && n === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (c === ',' && !inQ) { row.push(cur); cur = ''; }
    else if ((c === '\n' || (c === '\r' && n === '\n')) && !inQ) {
      row.push(cur.replace(/\r$/, '')); cur = '';
      if (c === '\r') i++;
      push();
    } else cur += c;
  }
  if (cur || row.length) { row.push(cur.replace(/\r$/, '')); push(); }
  return rows;
}

/* ── XLSX color extraction ── */

/** Minimal ZIP reader — extracts named entries from a ZIP buffer */
function readZipEntries(buf: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  // Find end-of-central-directory
  let eocdPos = buf.length - 22;
  while (eocdPos >= 0 && buf.readUInt32LE(eocdPos) !== 0x06054b50) eocdPos--;
  if (eocdPos < 0) return entries;

  const cdOffset = buf.readUInt32LE(eocdPos + 16);
  const cdSize = buf.readUInt32LE(eocdPos + 12);
  let pos = cdOffset;
  const cdEnd = cdOffset + cdSize;

  while (pos < cdEnd && buf.readUInt32LE(pos) === 0x02014b50) {
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localOffset = buf.readUInt32LE(pos + 42);
    const name = buf.toString('utf8', pos + 46, pos + 46 + nameLen);

    // Read local file header
    const lhPos = localOffset;
    if (buf.readUInt32LE(lhPos) === 0x04034b50) {
      const lhNameLen = buf.readUInt16LE(lhPos + 26);
      const lhExtraLen = buf.readUInt16LE(lhPos + 28);
      const compSize = buf.readUInt32LE(lhPos + 18);
      const compMethod = buf.readUInt16LE(lhPos + 8);
      const dataStart = lhPos + 30 + lhNameLen + lhExtraLen;

      if (compMethod === 0) {
        // Stored (no compression)
        entries.set(name, buf.subarray(dataStart, dataStart + compSize));
      } else {
        // Deflate — use zlib
        try {
          const zlib = require('zlib');
          const raw = buf.subarray(dataStart, dataStart + compSize);
          entries.set(name, zlib.inflateRawSync(raw));
        } catch { /* skip */ }
      }
    }
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** Parse XML and extract fill colors + style-to-fill mapping */
function parseXlsxColors(xlsxBuf: Buffer): Map<number, Map<number, string>> {
  const entries = readZipEntries(xlsxBuf);
  const stylesXml = entries.get('xl/styles.xml')?.toString('utf8');
  const sheetXml = entries.get('xl/worksheets/sheet1.xml')?.toString('utf8');
  if (!stylesXml || !sheetXml) return new Map();

  // Extract fills: find <fgColor rgb="FFRRGGBB"/>
  const fillColors: Record<number, string> = {};
  const fillRegex = /<fill>[\s\S]*?<\/fill>/g;
  let fillMatch;
  let fillIdx = 0;
  while ((fillMatch = fillRegex.exec(stylesXml)) !== null) {
    const fgMatch = fillMatch[0].match(/fgColor rgb="FF([0-9A-Fa-f]{6})"/);
    if (fgMatch && fgMatch[1] !== 'FFFFFF') {
      fillColors[fillIdx] = '#' + fgMatch[1];
    }
    fillIdx++;
  }

  // Extract cellXfs: each <xf fillId="N" ...>
  const styleToColor: Record<number, string> = {};
  const xfsBlock = stylesXml.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/);
  if (xfsBlock) {
    const xfRegex = /<xf[^>]*>/g;
    let xfMatch;
    let xfIdx = 0;
    while ((xfMatch = xfRegex.exec(xfsBlock[1])) !== null) {
      const fillIdMatch = xfMatch[0].match(/fillId="(\d+)"/);
      if (fillIdMatch) {
        const fid = parseInt(fillIdMatch[1]);
        if (fillColors[fid]) styleToColor[xfIdx] = fillColors[fid];
      }
      xfIdx++;
    }
  }

  // Parse sheet: extract per-cell style index
  const colorMap = new Map<number, Map<number, string>>();
  const rowRegex = /<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
    const rowNum = parseInt(rowMatch[1]);
    const dataRowIdx = rowNum - 3; // 0-indexed data row (skip 2 header rows)
    if (dataRowIdx < 0) continue;

    const cellRegex = /<c r="([A-Z]+)\d+"[^>]*s="(\d+)"[^/>]*/g;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowMatch[2])) !== null) {
      const colStr = cellMatch[1];
      const styleIdx = parseInt(cellMatch[2]);
      const color = styleToColor[styleIdx];
      if (color) {
        // Convert column letter to 0-based index
        let colIdx = 0;
        for (const ch of colStr) colIdx = colIdx * 26 + (ch.charCodeAt(0) - 64);
        colIdx--; // 0-based

        if (!colorMap.has(dataRowIdx)) colorMap.set(dataRowIdx, new Map());
        colorMap.get(dataRowIdx)!.set(colIdx, color);
      }
    }
  }
  return colorMap;
}

/* ── Main fetch ── */
export async function fetchGoogleSheetData(): Promise<SheetsData> {
  // Fetch CSV (for values) and XLSX (for colors) in parallel
  const [csvRes, xlsxRes] = await Promise.all([
    fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`, { redirect: 'follow' }),
    fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&gid=${GID}`, { redirect: 'follow' }),
  ]);
  if (!csvRes.ok) throw new Error(`CSV fetch failed: ${csvRes.status}`);
  if (!xlsxRes.ok) throw new Error(`XLSX fetch failed: ${xlsxRes.status}`);

  const csvText = await csvRes.text();
  const xlsxBuf = Buffer.from(await xlsxRes.arrayBuffer());

  // Parse values from CSV
  const allRows = parseCSV(csvText);
  if (allRows.length < 2) throw new Error('Sheet has < 2 rows');

  const groupHeaders = allRows[0].map(v => v.trim());
  const headers = allRows[1].map(v => v.trim());
  const colCount = headers.length;

  // Parse colors from XLSX
  const colorMap = parseXlsxColors(xlsxBuf);

  // Build data rows
  let dataRowIdx = 0;
  const dataRows: SheetsCell[][] = [];
  for (let i = 2; i < allRows.length; i++) {
    const raw = allRows[i];
    if (raw.every(v => v.trim() === '')) { dataRowIdx++; continue; }

    const rowColors = colorMap.get(dataRowIdx);
    const cells: SheetsCell[] = [];
    for (let j = 0; j < colCount; j++) {
      const rv = (raw[j] ?? '').trim();
      let value: string | number | null;
      if (rv === '') value = null;
      else { const n = parseFloat(rv.replace(/,/g, '')); value = !isNaN(n) && /^-?[\d,.]+$/.test(rv) ? n : rv; }

      const bg = rowColors?.get(j);
      cells.push({ value, ...(bg ? { backgroundColor: bg } : {}) });
    }
    dataRows.push(cells);
    dataRowIdx++;
  }

  return { headers, rows: dataRows, lastUpdated: new Date().toISOString(), sheetTitle: 'Market Breadth', groupHeaders };
}
