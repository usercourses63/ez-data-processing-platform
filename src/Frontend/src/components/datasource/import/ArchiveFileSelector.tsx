/**
 * ArchiveFileSelector - Shows file list from archive with selection UI and password input.
 * Per D-16, D-17: encrypted detection, file selection, auto-select single file.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Input, Button, Radio, Typography, Space, Alert } from 'antd';
import { LockOutlined, FileOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ArchiveResult, ArchiveFileEntry } from '../../../utils/fileAnalyzer/archiveHandler';
import { getDataFilesFromArchive } from '../../../utils/fileAnalyzer/archiveHandler';

const { Text, Title } = Typography;

interface ArchiveFileSelectorProps {
  archiveResult: ArchiveResult;
  onFileSelected: (filename: string, password?: string) => void;
  loading?: boolean;
}

const ArchiveFileSelector: React.FC<ArchiveFileSelectorProps> = ({
  archiveResult,
  onFileSelected,
  loading = false,
}) => {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const dataFiles = useMemo(() => getDataFilesFromArchive(archiveResult), [archiveResult]);

  // Auto-select if single data file (per D-16)
  useEffect(() => {
    if (dataFiles.length === 1) {
      setSelectedFile(dataFiles[0].name);
    }
  }, [dataFiles]);

  const handleAnalyze = () => {
    if (!selectedFile) return;
    onFileSelected(selectedFile, archiveResult.isEncrypted ? password : undefined);
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div>
      {archiveResult.isEncrypted && (
        <div style={{ marginBottom: 16 }}>
          <Text strong>
            <LockOutlined style={{ marginInlineEnd: 4 }} />
            {t('datasources.import.enterPassword')}
          </Text>
          <Input.Password
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('datasources.import.enterPassword')}
            style={{ marginTop: 8, maxWidth: 400 }}
          />
        </div>
      )}

      {dataFiles.length === 0 && !archiveResult.isEncrypted && (
        <Alert
          type="warning"
          message={t('datasources.import.noDataFilesInArchive', { defaultValue: 'No supported data files found in archive' })}
          style={{ marginBottom: 16 }}
        />
      )}

      {dataFiles.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Title level={5}>{t('datasources.import.selectFile')}</Title>
          <Radio.Group
            value={selectedFile}
            onChange={(e) => setSelectedFile(e.target.value)}
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            {dataFiles.map((entry: ArchiveFileEntry) => (
              <Radio key={entry.name} value={entry.name}>
                <Space>
                  <FileOutlined />
                  <span style={{ fontFamily: 'monospace' }}>{entry.name}</span>
                  <Text type="secondary">({formatSize(entry.size)})</Text>
                </Space>
              </Radio>
            ))}
          </Radio.Group>
        </div>
      )}

      <Button
        type="primary"
        onClick={handleAnalyze}
        disabled={!selectedFile || (archiveResult.isEncrypted && !password)}
        loading={loading}
      >
        {t('datasources.import.analyzeSelected')}
      </Button>
    </div>
  );
};

export default ArchiveFileSelector;
