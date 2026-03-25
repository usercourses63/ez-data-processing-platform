/**
 * XML Analyzer
 * Parses XML files using the browser DOMParser, extracts record structure,
 * builds Ant Design TreeDataNode for preview, and infers schema.
 */

import type { ImportData, XmlTreeNode } from './types';
import { PREVIEW_ROW_COUNT } from './types';
import { generateJsonSchema, buildFieldTypes, buildFieldConstraints } from './schemaInferrer';
import { inferFilePattern, inferDatasourceName } from './patternInferrer';

/**
 * Analyze an XML file and produce an ImportData result.
 *
 * Expects a root element with repeating child elements (records).
 * Each record's child elements are treated as fields.
 *
 * @param text - Decoded XML text content
 * @param filename - Original filename for pattern inference
 * @param encoding - Detected encoding name
 */
export function analyzeXml(text: string, filename: string, encoding: string): ImportData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/xml');

  // Check for parse errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`Invalid XML: ${parseError.textContent || 'Parse error'}`);
  }

  const root = doc.documentElement;
  if (!root) {
    throw new Error('XML document has no root element');
  }

  // Find repeating record elements (root's direct element children)
  const childElements = Array.from(root.children);
  if (childElements.length === 0) {
    throw new Error('XML root element has no child elements');
  }

  // Use the tag name of the first child as the record element name
  const recordTagName = childElements[0].tagName;
  const recordElements = childElements.filter((el) => el.tagName === recordTagName);

  if (recordElements.length === 0) {
    throw new Error('No repeating record elements found in XML');
  }

  // Extract field names from the first record's direct child elements
  const firstRecord = recordElements[0];
  const fieldElements = Array.from(firstRecord.children);
  const fieldNames = fieldElements.map((el) => el.tagName);

  if (fieldNames.length === 0) {
    throw new Error('XML record has no field elements');
  }

  // Recursively convert XML element to a JS object preserving nesting
  function xmlElementToObject(el: Element): unknown {
    const children = Array.from(el.children);
    if (children.length === 0) {
      // Leaf node — return text content with type inference
      const text = el.textContent?.trim() ?? '';
      // Try to parse as number/boolean
      if (/^-?\d+$/.test(text)) return parseInt(text, 10);
      if (/^-?\d+\.\d+$/.test(text)) return parseFloat(text);
      if (text === 'true') return true;
      if (text === 'false') return false;
      return text;
    }

    // Check if children are repeating elements (array)
    const tagCounts: Record<string, number> = {};
    children.forEach((c) => { tagCounts[c.tagName] = (tagCounts[c.tagName] || 0) + 1; });
    const hasRepeating = Object.values(tagCounts).some((count) => count > 1);

    if (hasRepeating && Object.keys(tagCounts).length === 1) {
      // All children same tag — this is an array
      return children.map((c) => xmlElementToObject(c));
    }

    // Mixed children — nested object
    const obj: Record<string, unknown> = {};
    for (const child of children) {
      if (tagCounts[child.tagName] > 1) {
        // Repeated tag within mixed content — collect as array
        if (!obj[child.tagName]) {
          obj[child.tagName] = children
            .filter((c) => c.tagName === child.tagName)
            .map((c) => xmlElementToObject(c));
        }
      } else {
        obj[child.tagName] = xmlElementToObject(child);
      }
    }
    return obj;
  }

  // Extract data rows as nested objects
  const dataRows = recordElements.map((record) => {
    const row: Record<string, unknown> = {};
    for (const child of Array.from(record.children)) {
      row[child.tagName] = xmlElementToObject(child);
    }
    return row;
  });

  // Build preview rows (first 5 records, D-09) — preserve nested structure
  const previewRows = dataRows.slice(0, PREVIEW_ROW_COUNT);

  // Generate JSON Schema with auto-suggest (IMPORT-02, IMPORT-04)
  // Pass raw nested objects so recursive inference works
  const jsonSchema = generateJsonSchema(fieldNames, dataRows as any, true);

  // Build field types for preview display (D-10) — shows object/array for nested
  const fieldTypes = buildFieldTypes(fieldNames, dataRows as any);
  const fieldConstraints = buildFieldConstraints(fieldNames);

  // Build XML tree data for collapsible preview (D-11)
  const xmlTreeData = buildXmlTreeData(root);

  // Pretty-print the raw XML for browser-style preview
  const serializer = new XMLSerializer();
  const rawXmlSource = formatXml(serializer.serializeToString(doc));

  return {
    name: inferDatasourceName(filename),
    fileType: 'XML',
    encoding,
    jsonSchema,
    filePattern: inferFilePattern(filename),
    previewRows,
    totalRowCount: recordElements.length,
    fieldNames,
    fieldTypes,
    fieldConstraints,
    xmlTreeData,
    rawXmlSource,
  };
}

/**
 * Build Ant Design TreeDataNode[] from an XML element tree.
 * Recursive walk: each element becomes a tree node.
 * Leaf nodes (no element children) show tagName: textContent.
 *
 * @param element - Root XML element to walk
 * @param keyPrefix - Key prefix for unique node keys
 */
export function buildXmlTreeData(element: Element, keyPrefix: string = '0'): XmlTreeNode[] {
  const nodes: XmlTreeNode[] = [];
  const children = Array.from(element.children);

  if (children.length === 0) {
    // Current element is a leaf -- represented by the parent call
    return [];
  }

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const key = `${keyPrefix}-${i}`;
    const childElements = Array.from(child.children);

    if (childElements.length === 0) {
      // Leaf node: show tagName: textContent
      const textContent = child.textContent?.trim() ?? '';
      nodes.push({
        title: textContent ? `${child.tagName}: ${textContent}` : child.tagName,
        key,
        isLeaf: true,
      });
    } else {
      // Branch node: recurse into children
      nodes.push({
        title: child.tagName,
        key,
        children: buildXmlTreeData(child, key),
      });
    }
  }

  return nodes;
}

/**
 * Pretty-print XML string with proper indentation.
 */
function formatXml(xml: string): string {
  let formatted = '';
  let indent = 0;
  const pad = (n: number) => '  '.repeat(n);

  // Split by tags
  xml = xml.replace(/(>)\s*(<)/g, '$1\n$2');
  const lines = xml.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Closing tag
    if (trimmed.startsWith('</')) {
      indent = Math.max(0, indent - 1);
      formatted += pad(indent) + trimmed + '\n';
    }
    // Self-closing tag
    else if (trimmed.endsWith('/>')) {
      formatted += pad(indent) + trimmed + '\n';
    }
    // Opening tag with content on same line (e.g., <tag>value</tag>)
    else if (trimmed.match(/^<[^/].*>.*<\//)) {
      formatted += pad(indent) + trimmed + '\n';
    }
    // Opening tag
    else if (trimmed.startsWith('<') && !trimmed.startsWith('<?')) {
      formatted += pad(indent) + trimmed + '\n';
      indent++;
    }
    // Processing instruction or other
    else {
      formatted += pad(indent) + trimmed + '\n';
    }
  }

  return formatted.trim();
}
