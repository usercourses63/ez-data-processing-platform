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

  // Extract field names from the first record's child elements
  const firstRecord = recordElements[0];
  const fieldElements = Array.from(firstRecord.children);
  const fieldNames = fieldElements.map((el) => el.tagName);

  if (fieldNames.length === 0) {
    throw new Error('XML record has no field elements');
  }

  // Extract data rows as string records
  const dataRows = recordElements.map((record) => {
    const row: Record<string, string> = {};
    for (const fieldName of fieldNames) {
      const fieldEl = record.querySelector(`:scope > ${fieldName}`);
      row[fieldName] = fieldEl?.textContent ?? '';
    }
    return row;
  });

  // Build preview rows (first 5 records, D-09)
  const previewRows = dataRows.slice(0, PREVIEW_ROW_COUNT).map((row) => ({ ...row }));

  // Generate JSON Schema with auto-suggest (IMPORT-02, IMPORT-04)
  const jsonSchema = generateJsonSchema(fieldNames, dataRows, true);

  // Build field types and constraints for preview display (D-10)
  const fieldTypes = buildFieldTypes(fieldNames, dataRows);
  const fieldConstraints = buildFieldConstraints(fieldNames);

  // Build XML tree data for collapsible preview (D-11)
  const xmlTreeData = buildXmlTreeData(root);

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
