/**
 * ImportPreviewModal - Main orchestrator modal for the import preview step.
 * Per D-03, D-04, D-08: Shows extraction results, allows field name editing for headerless CSV.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Descriptions, Spin, App } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ImportData } from '../../../utils/fileAnalyzer/types';
import type { ArchiveResult } from '../../../utils/fileAnalyzer/archiveHandler';
import { extractAndAnalyze } from '../../../utils/fileAnalyzer/archiveHandler';
import { analyzeFile } from '../../../utils/fileAnalyzer';
import {
  generateJsonSchema,
  buildFieldTypes,
  buildFieldConstraints,
} from '../../../utils/fileAnalyzer/schemaInferrer';
import DataPreviewTable from './DataPreviewTable';
import XmlTreePreview from './XmlTreePreview';
import HeaderlessFieldEditor from './HeaderlessFieldEditor';
import ExtractionChecklist from './ExtractionChecklist';
import ArchiveFileSelector from './ArchiveFileSelector';

interface ImportPreviewModalProps {
  visible: boolean;
  importData: ImportData | null;
  archiveResult: ArchiveResult | null;
  onContinue: (data: ImportData) => void;
  onCancel: () => void;
}

const ImportPreviewModal: React.FC<ImportPreviewModalProps> = ({
  visible,
  importData: initialImportData,
  archiveResult,
  onContinue,
  onCancel,
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();

  const [importData, setImportData] = useState<ImportData | null>(initialImportData);
  const [editedFieldNames, setEditedFieldNames] = useState<string[]>([]);
  const [editedHasHeaders, setEditedHasHeaders] = useState(true);
  const [archiveLoading, setArchiveLoading] = useState(false);

  // Sync initial importData
  useEffect(() => {
    setImportData(initialImportData);
    if (initialImportData) {
      setEditedFieldNames(initialImportData.fieldNames);
      setEditedHasHeaders(initialImportData.hasHeaders ?? true);
    }
  }, [initialImportData]);

  // Handle field name changes for headerless CSV -- re-generate schema
  const handleFieldNamesChange = useCallback(
    (newNames: string[]) => {
      setEditedFieldNames(newNames);
      if (!importData) return;

      // Remap preview rows to use new field names
      const oldNames = importData.fieldNames;
      const remappedRows = importData.previewRows.map((row) => {
        const newRow: Record<string, unknown> = {};
        oldNames.forEach((oldName, idx) => {
          const newName = newNames[idx] || `field_${idx + 1}`;
          newRow[newName] = row[oldName];
        });
        return newRow;
      });

      // Apply fallback for blank names
      const finalNames = newNames.map((n, i) => n.trim() || `field_${i + 1}`);
      const stringRows = remappedRows.map((row) => {
        const sr: Record<string, string> = {};
        for (const [k, v] of Object.entries(row)) sr[k] = String(v ?? '');
        return sr;
      });

      const newSchema = generateJsonSchema(finalNames, stringRows, true);
      const newFieldTypes = buildFieldTypes(finalNames, stringRows);
      const newFieldConstraints = buildFieldConstraints(finalNames);

      setImportData({
        ...importData,
        fieldNames: finalNames,
        previewRows: remappedRows,
        jsonSchema: newSchema,
        fieldTypes: newFieldTypes,
        fieldConstraints: newFieldConstraints,
      });
    },
    [importData]
  );

  // Handle headers toggle change
  const handleHasHeadersChange = useCallback(
    (val: boolean) => {
      setEditedHasHeaders(val);
      if (!importData) return;
      // Update the importData's hasHeaders flag. Full re-analysis would need original data,
      // but we just track the toggle for form pre-fill. Field names stay as-is.
      setImportData({ ...importData, hasHeaders: val });
    },
    [importData]
  );

  // Handle archive file selection and analysis
  const handleArchiveFileSelected = async (filename: string, password?: string) => {
    if (!archiveResult) return;
    setArchiveLoading(true);
    try {
      const result = await extractAndAnalyze(
        archiveResult,
        filename,
        analyzeFile as unknown as (file: File) => Promise<Record<string, unknown>>,
        password
      );
      const data = result as unknown as ImportData;
      setImportData(data);
      setEditedFieldNames(data.fieldNames);
      setEditedHasHeaders(data.hasHeaders ?? true);
    } catch (err) {
      console.error('Archive extraction error:', err);
      message.error(
        t('datasources.import.parseError') +
          (err instanceof Error ? `: ${err.message}` : '')
      );
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleContinue = () => {
    if (!importData) return;
    // Apply final hasHeaders value
    const finalData: ImportData = {
      ...importData,
      hasHeaders: editedHasHeaders,
    };
    onContinue(finalData);
  };

  const isCsvHeaderless = importData?.fileType === 'CSV' && !editedHasHeaders;
  const isXml = importData?.fileType === 'XML';

  return (
    <Modal
      open={visible}
      title={t('datasources.import.previewTitle')}
      width="90vw"
      style={{ maxWidth: 1400 }}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          {t('datasources.import.cancel')}
        </Button>,
        <Button
          key="continue"
          type="primary"
          onClick={handleContinue}
          disabled={!importData}
        >
          {t('datasources.import.continue')}
        </Button>,
      ]}
    >
      <Spin spinning={archiveLoading}>
        {/* Archive file selector (when no importData yet) */}
        {archiveResult && !importData && (
          <ArchiveFileSelector
            archiveResult={archiveResult}
            onFileSelected={handleArchiveFileSelected}
            loading={archiveLoading}
          />
        )}

        {/* Import data preview */}
        {importData && (
          <>
            {/* File info summary */}
            <Descriptions
              size="small"
              column={3}
              bordered
              style={{ marginBottom: 16 }}
            >
              <Descriptions.Item label={t('datasources.import.fileInfo')}>
                {importData.name}
              </Descriptions.Item>
              <Descriptions.Item label={t('datasources.fields.fileType', { defaultValue: 'Type' })}>
                {importData.fileType}
              </Descriptions.Item>
              <Descriptions.Item label={t('datasources.fields.encoding', { defaultValue: 'Encoding' })}>
                {importData.encoding}
              </Descriptions.Item>
              {importData.csvDelimiter && (
                <Descriptions.Item label={t('datasources.fields.delimiter', { defaultValue: 'Delimiter' })}>
                  {importData.csvDelimiter === '\t' ? 'Tab' : importData.csvDelimiter}
                </Descriptions.Item>
              )}
            </Descriptions>

            <div style={{ display: 'flex', gap: 16 }}>
              {/* Left column (60%): Data preview */}
              <div style={{ flex: 3, minWidth: 0 }}>
                {/* Headerless CSV editor */}
                {importData.fileType === 'CSV' && (
                  <HeaderlessFieldEditor
                    fieldNames={editedFieldNames}
                    previewRows={importData.previewRows}
                    hasHeaders={editedHasHeaders}
                    onFieldNamesChange={handleFieldNamesChange}
                    onHasHeadersChange={handleHasHeadersChange}
                  />
                )}

                {/* JSON hierarchical view — pretty-printed JSON */}
                {importData.fileType === 'JSON' && importData.previewRows.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <pre style={{
                      background: '#f5f5f5',
                      border: '1px solid #d9d9d9',
                      borderRadius: 6,
                      padding: 12,
                      maxHeight: 400,
                      overflow: 'auto',
                      fontSize: 12,
                      direction: 'ltr',
                      textAlign: 'left',
                    }}>
                      {JSON.stringify(importData.previewRows.slice(0, 3), null, 2)}
                    </pre>
                    <div style={{ marginTop: 8, color: '#8c8c8c', fontSize: 12 }}>
                      {t('datasources.import.totalRows', { count: importData.totalRowCount })}
                    </div>
                  </div>
                )}

                {/* XML browser-style view — formatted raw XML source */}
                {isXml && importData.rawXmlSource && (
                  <div style={{ marginBottom: 16 }}>
                    <pre style={{
                      background: '#f9f9f9',
                      border: '1px solid #d9d9d9',
                      borderRadius: 6,
                      padding: 12,
                      maxHeight: 400,
                      overflow: 'auto',
                      fontSize: 12,
                      direction: 'ltr',
                      textAlign: 'left',
                      color: '#333',
                    }}>
                      {importData.rawXmlSource}
                    </pre>
                    <div style={{ marginTop: 8, color: '#8c8c8c', fontSize: 12 }}>
                      {t('datasources.import.totalRows', { count: importData.totalRowCount })}
                    </div>
                  </div>
                )}

                {/* CSV/Excel flat data table — tabular format only */}
                {(importData.fileType === 'CSV' || importData.fileType === 'Excel') && (
                  <DataPreviewTable
                    previewRows={importData.previewRows}
                    fieldNames={importData.fieldNames}
                    totalRowCount={importData.totalRowCount}
                  />
                )}
              </div>

              {/* Right column (40%): Extraction checklist */}
              <div style={{ flex: 2 }}>
                <ExtractionChecklist
                  fieldNames={importData.fieldNames}
                  fieldTypes={importData.fieldTypes}
                  fieldConstraints={importData.fieldConstraints}
                />
              </div>
            </div>
          </>
        )}
      </Spin>
    </Modal>
  );
};

export default ImportPreviewModal;
