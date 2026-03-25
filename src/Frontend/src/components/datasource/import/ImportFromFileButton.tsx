/**
 * ImportFromFileButton - Upload File button that triggers client-side file analysis.
 * Per D-01, D-02: Button next to Create Datasource, accepts data + archive formats.
 * Uses App.useApp() for messages (NEVER static message.error).
 */
import React, { useState } from 'react';
import { Button, Upload, App } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ImportData } from '../../../utils/fileAnalyzer/types';
import type { ArchiveResult } from '../../../utils/fileAnalyzer/archiveHandler';
import { analyzeFile, getFileExtension, isArchiveExtension, isSupportedExtension, MAX_FILE_SIZE_BYTES } from '../../../utils/fileAnalyzer';
import { handleArchive } from '../../../utils/fileAnalyzer/archiveHandler';

/** 50MB hard limit */
const HARD_LIMIT_BYTES = 50 * 1024 * 1024;

interface ImportFromFileButtonProps {
  onAnalysisComplete: (data: ImportData) => void;
  onArchiveDetected: (result: ArchiveResult) => void;
}

const ImportFromFileButton: React.FC<ImportFromFileButtonProps> = ({
  onAnalysisComplete,
  onArchiveDetected,
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  const handleBeforeUpload = async (file: File) => {
    const ext = getFileExtension(file.name);

    // Check supported format
    if (!isSupportedExtension(ext)) {
      message.error(t('datasources.import.unsupportedFormat'));
      return false;
    }

    // Hard limit 50MB
    if (file.size > HARD_LIMIT_BYTES) {
      message.error(t('datasources.import.fileTooLarge'));
      return false;
    }

    // Soft limit 10MB warning
    if (file.size > MAX_FILE_SIZE_BYTES) {
      message.warning(
        t('datasources.import.fileTooLarge', {
          defaultValue: 'File exceeds 10MB. Analysis may take longer.',
        })
      );
    }

    setLoading(true);
    try {
      if (isArchiveExtension(ext)) {
        const archiveResult = await handleArchive(file);
        onArchiveDetected(archiveResult);
      } else {
        const importData = await analyzeFile(file);
        onAnalysisComplete(importData);
      }
    } catch (err) {
      console.error('File analysis error:', err);
      message.error(
        t('datasources.import.parseError') +
          (err instanceof Error ? `: ${err.message}` : '')
      );
    } finally {
      setLoading(false);
    }

    // Return false to prevent actual upload
    return false;
  };

  return (
    <Upload
      beforeUpload={handleBeforeUpload}
      showUploadList={false}
      accept=".csv,.json,.xml,.xlsx,.xls,.zip,.tar.gz,.rar,.7z"
      disabled={loading}
    >
      <Button icon={<UploadOutlined />} loading={loading}>
        {t('datasources.importFromFile')}
      </Button>
    </Upload>
  );
};

export default ImportFromFileButton;
