/**
 * Generates a minimal valid .xlsx file for protocol testing.
 * Run with: node generate-xlsx.js
 *
 * An xlsx file is a ZIP archive containing XML files following
 * the Office Open XML SpreadsheetML format.
 */
const fs = require('fs');
const path = require('path');

// Simple CRC32 implementation
function crc32(buf) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createLocalFileHeader(fname, data) {
  const fnameBuffer = Buffer.from(fname, 'utf-8');
  const crc = crc32(data);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(data.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(fnameBuffer.length, 26);
  header.writeUInt16LE(0, 28);
  return Buffer.concat([header, fnameBuffer, data]);
}

function createCentralDirectoryEntry(fname, data, offset) {
  const fnameBuffer = Buffer.from(fname, 'utf-8');
  const crc = crc32(data);
  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50, 0);
  entry.writeUInt16LE(20, 4);
  entry.writeUInt16LE(20, 6);
  entry.writeUInt16LE(0, 8);
  entry.writeUInt16LE(0, 10);
  entry.writeUInt16LE(0, 12);
  entry.writeUInt16LE(0, 14);
  entry.writeUInt32LE(crc, 16);
  entry.writeUInt32LE(data.length, 20);
  entry.writeUInt32LE(data.length, 24);
  entry.writeUInt16LE(fnameBuffer.length, 28);
  entry.writeUInt16LE(0, 30);
  entry.writeUInt16LE(0, 32);
  entry.writeUInt16LE(0, 34);
  entry.writeUInt16LE(0, 36);
  entry.writeUInt32LE(0, 38);
  entry.writeUInt32LE(offset, 42);
  return Buffer.concat([entry, fnameBuffer]);
}

function createEndOfCentralDirectory(numEntries, cdSize, cdOffset) {
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(numEntries, 8);
  eocd.writeUInt16LE(numEntries, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);
  return eocd;
}

// XLSX XML contents
const contentTypes = [
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
  '<Default Extension="xml" ContentType="application/xml"/>',
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
  '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>',
  '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>',
  '</Types>'
].join('');

const rels = [
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>',
  '</Relationships>'
].join('');

const workbookRels = [
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>',
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>',
  '</Relationships>'
].join('');

const workbook = [
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
  '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
  '<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>',
  '</workbook>'
].join('');

const sharedStrings = [
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
  '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="20" uniqueCount="20">',
  '<si><t>Id</t></si>',
  '<si><t>Name</t></si>',
  '<si><t>Category</t></si>',
  '<si><t>Amount</t></si>',
  '<si><t>Description</t></si>',
  '<si><t>Test Item</t></si>',
  '<si><t>Sales</t></si>',
  '<si><t>First test record</t></si>',
  '<si><t>\u05E4\u05E8\u05D9\u05D8 \u05D1\u05D3\u05D9\u05E7\u05D4</t></si>',
  '<si><t>Finance</t></si>',
  '<si><t>\u05E8\u05E9\u05D5\u05DE\u05EA \u05D1\u05D3\u05D9\u05E7\u05D4 \u05E9\u05E0\u05D9\u05D9\u05D4</t></si>',
  '<si><t>Mixed \u05E9\u05D9\u05DC\u05D5\u05D1</t></si>',
  '<si><t>HR</t></si>',
  '<si><t>Record with mixed content</t></si>',
  '<si><t>Another Item</t></si>',
  '<si><t>Inventory</t></si>',
  '<si><t>Fourth test record</t></si>',
  '<si><t>\u05E4\u05E8\u05D9\u05D8 \u05D0\u05D7\u05E8\u05D5\u05DF</t></si>',
  '<si><t>Operations</t></si>',
  '<si><t>\u05E8\u05E9\u05D5\u05DE\u05D4 \u05D0\u05D7\u05E8\u05D5\u05E0\u05D4</t></si>',
  '</sst>'
].join('');

const sheet1 = [
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
  '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
  '<sheetData>',
  '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c><c r="E1" t="s"><v>4</v></c></row>',
  '<row r="2"><c r="A2"><v>1</v></c><c r="B2" t="s"><v>5</v></c><c r="C2" t="s"><v>6</v></c><c r="D2"><v>100.5</v></c><c r="E2" t="s"><v>7</v></c></row>',
  '<row r="3"><c r="A3"><v>2</v></c><c r="B3" t="s"><v>8</v></c><c r="C3" t="s"><v>9</v></c><c r="D3"><v>200.75</v></c><c r="E3" t="s"><v>10</v></c></row>',
  '<row r="4"><c r="A4"><v>3</v></c><c r="B4" t="s"><v>11</v></c><c r="C4" t="s"><v>12</v></c><c r="D4"><v>350</v></c><c r="E4" t="s"><v>13</v></c></row>',
  '<row r="5"><c r="A5"><v>4</v></c><c r="B5" t="s"><v>14</v></c><c r="C5" t="s"><v>15</v></c><c r="D5"><v>425.25</v></c><c r="E5" t="s"><v>16</v></c></row>',
  '<row r="6"><c r="A6"><v>5</v></c><c r="B6" t="s"><v>17</v></c><c r="C6" t="s"><v>18</v></c><c r="D6"><v>550.99</v></c><c r="E6" t="s"><v>19</v></c></row>',
  '</sheetData>',
  '</worksheet>'
].join('');

// Build file list
const files = [
  { name: '[Content_Types].xml', data: Buffer.from(contentTypes, 'utf-8') },
  { name: '_rels/.rels', data: Buffer.from(rels, 'utf-8') },
  { name: 'xl/_rels/workbook.xml.rels', data: Buffer.from(workbookRels, 'utf-8') },
  { name: 'xl/workbook.xml', data: Buffer.from(workbook, 'utf-8') },
  { name: 'xl/sharedStrings.xml', data: Buffer.from(sharedStrings, 'utf-8') },
  { name: 'xl/worksheets/sheet1.xml', data: Buffer.from(sheet1, 'utf-8') },
];

// Build ZIP
const localHeaders = [];
const cdEntries = [];
let offset = 0;

for (const file of files) {
  const lh = createLocalFileHeader(file.name, file.data);
  localHeaders.push(lh);
  cdEntries.push(createCentralDirectoryEntry(file.name, file.data, offset));
  offset += lh.length;
}

const cdOffset = offset;
const cd = Buffer.concat(cdEntries);
const eocd = createEndOfCentralDirectory(files.length, cd.length, cdOffset);

const xlsx = Buffer.concat([...localHeaders, cd, eocd]);
const outputPath = path.join(__dirname, 'test-data.xlsx');
fs.writeFileSync(outputPath, xlsx);
console.log('Created ' + outputPath + ' (' + xlsx.length + ' bytes)');
