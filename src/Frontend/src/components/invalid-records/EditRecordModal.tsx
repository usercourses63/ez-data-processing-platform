import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Form, Input, Button, message, Descriptions, Typography, Space, Tooltip, Tag, Alert, Select } from 'antd';
import { WarningOutlined, InfoCircleOutlined, CheckCircleOutlined, EditOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { InvalidRecord } from '../../services/invalidrecords-api-client';
import { translateErrors, TranslatedError } from '../../utils/validationErrorTranslator';

const { Text, Title, Link } = Typography;

interface EditRecordModalProps {
  visible: boolean;
  record: InvalidRecord | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface FieldError {
  fieldName: string;
  originalValue: any;
  translated: TranslatedError;
}

interface SchemaFieldDefinition {
  type?: string;
  enum?: string[];
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  format?: string;
  description?: string;
}

interface JsonSchemaProperties {
  [fieldName: string]: SchemaFieldDefinition;
}

const EditRecordModal: React.FC<EditRecordModalProps> = ({
  visible,
  record,
  onClose,
  onSuccess,
}) => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [failedFields, setFailedFields] = useState<FieldError[]>([]);
  const [editedValues, setEditedValues] = useState<Record<string, any>>({});
  const [schemaProperties, setSchemaProperties] = useState<JsonSchemaProperties>({});
  const [schemaRequired, setSchemaRequired] = useState<string[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(false);

  useEffect(() => {
    console.log('EditRecordModal useEffect triggered', { record, visible });
    if (record && visible) {
      console.log('Record dataSourceId:', record.dataSourceId);
      // Extract failed fields from validation errors (filtered - no unknown)
      const fields = extractFailedFields(record);
      setFailedFields(fields);

      // Pre-populate form and edited values with current values
      const initialValues: Record<string, any> = {};
      fields.forEach(field => {
        initialValues[field.fieldName] = field.originalValue;
      });
      form.setFieldsValue(initialValues);
      setEditedValues(initialValues);

      // Fetch schema from datasource API
      if (record.dataSourceId) {
        console.log('Fetching schema for datasource:', record.dataSourceId);
        fetchSchemaProperties(record.dataSourceId);
      } else {
        console.log('No dataSourceId available on record');
      }
    } else {
      setFailedFields([]);
      form.resetFields();
      setEditedValues({});
      setSchemaProperties({});
    }
  }, [record, visible, form]);

  // Fetch schema properties from datasource API
  const fetchSchemaProperties = async (dataSourceId: string) => {
    console.log('fetchSchemaProperties called with:', dataSourceId);
    setSchemaLoading(true);
    try {
      const url = `/api/v1/datasource/${dataSourceId}`;
      console.log('Fetching URL:', url);
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        // Handle API response format: { Data: { JsonSchema: {...} } }
        const datasource = data.Data || data.value || data;
        // Handle both JsonSchema (API) and jsonSchema (lowercase) variants
        const jsonSchemaData = datasource?.JsonSchema || datasource?.jsonSchema;
        if (jsonSchemaData) {
          // Parse jsonSchema if it's a string
          const schema = typeof jsonSchemaData === 'string'
            ? JSON.parse(jsonSchemaData)
            : jsonSchemaData;
          console.log('Schema fetched:', schema);
          console.log('Schema properties:', schema.properties);
          console.log('Schema required:', schema.required);
          setSchemaProperties(schema.properties || {});
          setSchemaRequired(schema.required || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch schema:', error);
    } finally {
      setSchemaLoading(false);
    }
  };

  // Helper to generate example value from regex pattern
  const generateExampleFromPattern = (pattern: string): string | null => {
    // Common pattern mappings
    const patternExamples: Record<string, string> = {
      // Transaction ID patterns
      '^TXN-\\d{8}$': 'TXN-12345678',
      '^TXN-\\d+$': 'TXN-123456',
      // Date patterns
      '^\\d{4}-\\d{2}-\\d{2}$': '2025-01-15',
      '^\\d{2}/\\d{2}/\\d{4}$': '15/01/2025',
      // Email pattern
      '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$': 'user@example.com',
      // Phone patterns
      '^\\d{10}$': '0501234567',
      '^\\d{3}-\\d{3}-\\d{4}$': '050-123-4567',
      // ID patterns
      '^[A-Z]{2}-\\d{4}$': 'AB-1234',
      '^[A-Z]{3}\\d{6}$': 'ABC123456',
      // UUID pattern
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$': 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    };

    // Try exact match first
    if (patternExamples[pattern]) {
      return patternExamples[pattern];
    }

    // Try to generate from pattern structure
    let example = pattern;

    // Remove anchors
    example = example.replace(/^\^/, '').replace(/\$$/, '');

    // Replace common regex patterns with examples
    example = example.replace(/\\d\{(\d+)\}/g, (_, count) => {
      return '1'.repeat(parseInt(count));
    });
    example = example.replace(/\\d\+/g, '123');
    example = example.replace(/\\d/g, '1');
    example = example.replace(/\\w\{(\d+)\}/g, (_, count) => {
      return 'a'.repeat(parseInt(count));
    });
    example = example.replace(/\\w\+/g, 'abc');
    example = example.replace(/\\w/g, 'a');
    example = example.replace(/\[A-Z\]\{(\d+)\}/g, (_, count) => {
      return 'A'.repeat(parseInt(count));
    });
    example = example.replace(/\[A-Z\]\+/g, 'ABC');
    example = example.replace(/\[A-Z\]/g, 'A');
    example = example.replace(/\[a-z\]\{(\d+)\}/g, (_, count) => {
      return 'a'.repeat(parseInt(count));
    });
    example = example.replace(/\[a-z\]\+/g, 'abc');
    example = example.replace(/\[a-z\]/g, 'a');
    example = example.replace(/\[0-9\]\{(\d+)\}/g, (_, count) => {
      return '1'.repeat(parseInt(count));
    });
    example = example.replace(/\[0-9\]\+/g, '123');
    example = example.replace(/\[0-9\]/g, '1');
    example = example.replace(/\[a-zA-Z0-9\]\+/g, 'abc123');
    example = example.replace(/\[a-zA-Z\]\+/g, 'abc');

    // Remove remaining regex special chars
    example = example.replace(/[\(\)\[\]\{\}\?\*\+\.\|\\]/g, '');

    // If the result looks like a valid example (not just the pattern), return it
    if (example !== pattern && example.length > 0 && !/[\\^$.*+?()[\]{}|]/.test(example)) {
      return example;
    }

    return null;
  };

  // Helper to format schema constraint for display
  const formatSchemaConstraint = (fieldDef: SchemaFieldDefinition | undefined, fieldName: string): React.ReactNode => {
    if (!fieldDef) return null;

    const constraints: React.ReactNode[] = [];
    const isRequired = schemaRequired.includes(fieldName);

    // Show required indicator first
    if (isRequired) {
      constraints.push(
        <div key="required" style={{ marginBottom: 4 }}>
          <Tag color="red" style={{ fontWeight: 'bold' }}>שדה חובה</Tag>
        </div>
      );
    }

    if (fieldDef.enum && fieldDef.enum.length > 0) {
      constraints.push(
        <div key="enum" style={{ marginBottom: 4 }}>
          <Text strong style={{ color: '#1890ff', fontSize: 12 }}>ערכים מותרים: </Text>
          <Space size={4} wrap>
            {fieldDef.enum.map((val, i) => (
              <Tag key={i} color="blue" style={{ marginBottom: 2 }}>{val}</Tag>
            ))}
          </Space>
        </div>
      );
    }

    if (fieldDef.pattern) {
      const example = generateExampleFromPattern(fieldDef.pattern);
      constraints.push(
        <div key="pattern" style={{ marginBottom: 4 }}>
          <Text strong style={{ color: '#722ed1', fontSize: 12 }}>תבנית נדרשת: </Text>
          <code style={{ backgroundColor: '#f0f0f0', padding: '2px 6px', fontSize: 11 }}>{fieldDef.pattern}</code>
          {example && (
            <>
              <br />
              <Text strong style={{ color: '#52c41a', fontSize: 12, marginTop: 2, display: 'inline-block' }}>דוגמה: </Text>
              <code style={{ backgroundColor: '#f6ffed', padding: '2px 6px', fontSize: 11, color: '#52c41a', border: '1px solid #b7eb8f' }}>{example}</code>
            </>
          )}
        </div>
      );
    }

    if (fieldDef.minLength !== undefined || fieldDef.maxLength !== undefined) {
      const lenText = fieldDef.minLength !== undefined && fieldDef.maxLength !== undefined
        ? `${fieldDef.minLength}-${fieldDef.maxLength} תווים`
        : fieldDef.minLength !== undefined
          ? `לפחות ${fieldDef.minLength} תווים`
          : `עד ${fieldDef.maxLength} תווים`;
      constraints.push(
        <div key="length" style={{ marginBottom: 4 }}>
          <Text strong style={{ color: '#13c2c2', fontSize: 12 }}>אורך: </Text>
          <Text style={{ fontSize: 12 }}>{lenText}</Text>
        </div>
      );
    }

    if (fieldDef.minimum !== undefined || fieldDef.maximum !== undefined) {
      const rangeText = fieldDef.minimum !== undefined && fieldDef.maximum !== undefined
        ? `${fieldDef.minimum} - ${fieldDef.maximum}`
        : fieldDef.minimum !== undefined
          ? `לפחות ${fieldDef.minimum}`
          : `עד ${fieldDef.maximum}`;
      constraints.push(
        <div key="range" style={{ marginBottom: 4 }}>
          <Text strong style={{ color: '#fa8c16', fontSize: 12 }}>טווח ערכים: </Text>
          <Text style={{ fontSize: 12 }}>{rangeText}</Text>
        </div>
      );
    }

    if (fieldDef.format) {
      // Provide helpful examples for common JSON Schema formats
      const formatExamples: Record<string, { label: string; example: string }> = {
        'date': { label: 'תאריך', example: '2025-12-16' },
        'date-time': { label: 'תאריך ושעה', example: '2025-12-16T14:30:00Z' },
        'time': { label: 'שעה', example: '14:30:00' },
        'email': { label: 'אימייל', example: 'user@example.com' },
        'uri': { label: 'כתובת URL', example: 'https://example.com' },
        'uuid': { label: 'מזהה ייחודי', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
        'ipv4': { label: 'כתובת IP', example: '192.168.1.1' },
        'hostname': { label: 'שם שרת', example: 'server.example.com' },
      };
      const formatInfo = formatExamples[fieldDef.format];

      constraints.push(
        <div key="format" style={{ marginBottom: 4 }}>
          <Text strong style={{ color: '#eb2f96', fontSize: 12 }}>פורמט: </Text>
          <Tag color="magenta">{formatInfo?.label || fieldDef.format}</Tag>
          {formatInfo && (
            <>
              <br />
              <Text strong style={{ color: '#52c41a', fontSize: 12, marginTop: 2, display: 'inline-block' }}>דוגמה: </Text>
              <code style={{ backgroundColor: '#f6ffed', padding: '2px 6px', fontSize: 11, color: '#52c41a', border: '1px solid #b7eb8f' }}>{formatInfo.example}</code>
            </>
          )}
        </div>
      );
    }

    if (fieldDef.type) {
      constraints.push(
        <div key="type" style={{ marginBottom: 4 }}>
          <Text strong style={{ color: '#52c41a', fontSize: 12 }}>סוג: </Text>
          <Tag color="green">{fieldDef.type}</Tag>
        </div>
      );
    }

    return constraints.length > 0 ? (
      <div style={{ marginTop: 8, padding: 8, backgroundColor: '#fafafa', borderRadius: 4, border: '1px solid #e8e8e8' }}>
        {constraints}
      </div>
    ) : null;
  };

  // Calculate if all errored fields have been modified
  const allErrorsCorrected = useMemo(() => {
    if (failedFields.length === 0) return false;
    return failedFields.every(field => {
      const edited = editedValues[field.fieldName];
      return edited !== undefined && edited !== field.originalValue && edited !== '';
    });
  }, [failedFields, editedValues]);

  // Extract field names from error messages (filtered - no unknown errors)
  const extractFailedFields = (record: InvalidRecord): FieldError[] => {
    const fields: FieldError[] = [];
    const seenFields = new Set<string>();

    // Use translateErrors which filters out unknown errors
    const translatedErrors = translateErrors(record.errors);

    translatedErrors.forEach(translated => {
      const fieldName = translated.fieldName;

      if (fieldName && fieldName !== 'unknown' && !seenFields.has(fieldName)) {
        seenFields.add(fieldName);

        // Get original value from record.originalData
        // For missing required fields, originalValue will be undefined - that's OK
        const originalValue = record.originalData[fieldName];

        fields.push({
          fieldName,
          originalValue,
          translated,
        });
      }
    });

    // Also check record.errors directly for field names (backend may have already extracted them)
    record.errors.forEach(error => {
      const fieldName = error.field;
      if (fieldName && !seenFields.has(fieldName)) {
        seenFields.add(fieldName);

        // Find corresponding translated error or create a basic one
        const translated = translatedErrors.find(t => t.fieldName === fieldName) || {
          fieldName,
          shortMessage: `${fieldName}: שגיאת אימות`,
          detailedMessage: error.message,
          validationType: 'unknown',
          expectedValue: error.expectedValue,
          actualValue: error.actualValue,
          isValid: true,
        };

        fields.push({
          fieldName,
          originalValue: record.originalData[fieldName],
          translated,
        });
      }
    });

    return fields;
  };

  // Build JSON preview with edited values highlighted
  const jsonPreview = useMemo(() => {
    if (!record) return null;

    const data = { ...record.originalData };
    const erroredFieldNames = new Set(failedFields.map(f => f.fieldName));

    return (
      <pre
        style={{
          backgroundColor: '#1e1e1e',
          color: '#d4d4d4',
          padding: 12,
          borderRadius: 8,
          overflow: 'auto',
          maxHeight: 200,
          fontSize: 12,
          lineHeight: 1.5,
          direction: 'ltr',
          textAlign: 'left',
          margin: 0,
        }}
      >
        <code>
          {'{'}
          {'\n'}
          {Object.entries(data).map(([key, originalValue], index, arr) => {
            const hasError = erroredFieldNames.has(key);
            const editedValue = editedValues[key];
            const isEdited = hasError && editedValue !== undefined && editedValue !== originalValue;
            const displayValue = isEdited ? editedValue : originalValue;
            const isLast = index === arr.length - 1;

            const renderValue = (val: any) => {
              if (typeof val === 'string') return `"${val}"`;
              if (typeof val === 'number' || typeof val === 'boolean') return String(val);
              if (val === null) return 'null';
              return JSON.stringify(val);
            };

            return (
              <span key={key}>
                {'  '}
                <span style={{ color: hasError ? '#ff6b6b' : '#9cdcfe' }}>
                  "{key}"
                </span>
                <span style={{ color: '#d4d4d4' }}>: </span>
                {isEdited ? (
                  <>
                    <span style={{ color: '#666', textDecoration: 'line-through' }}>
                      {renderValue(originalValue)}
                    </span>
                    <span style={{ color: '#4caf50', fontWeight: 'bold', marginRight: 4 }}>
                      {' → '}{renderValue(displayValue)}
                    </span>
                  </>
                ) : (
                  <span style={{
                    color: hasError ? '#ff6b6b' : (
                      typeof displayValue === 'string' ? '#ce9178' :
                      typeof displayValue === 'number' ? '#b5cea8' :
                      typeof displayValue === 'boolean' ? '#569cd6' : '#d4d4d4'
                    ),
                    fontWeight: hasError ? 'bold' : 'normal',
                  }}>
                    {renderValue(displayValue)}
                  </span>
                )}
                {!isLast && ','}
                {'\n'}
              </span>
            );
          })}
          {'}'}
        </code>
      </pre>
    );
  }, [record, failedFields, editedValues]);

  const handleFieldChange = (fieldName: string, value: any) => {
    setEditedValues(prev => ({ ...prev, [fieldName]: value }));
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      if (!record) return;

      // Merge corrected values with original data
      const correctedData: any = {
        ...record.originalData,
        ...values,
      };

      // Convert Amount to number if it's a string (schema expects number)
      if (correctedData.Amount && typeof correctedData.Amount === 'string') {
        const amountNum = parseFloat(correctedData.Amount);
        if (!isNaN(amountNum)) {
          correctedData.Amount = amountNum;
        }
      }

      // Call the API to correct and reprocess
      const response = await fetch(
        `/api/v1/invalid-records/${record.id}/correct`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            correctedData,
            correctedBy: 'User',
            autoReprocess: true,
          }),
        }
      );

      const result = await response.json();

      if (result.isSuccess) {
        form.resetFields();
        onClose();

        // Record is deleted immediately after correction, show success message
        message.success({
          content: 'הרשומה תוקנה ונמחקה בהצלחה. הנתונים המתוקנים נשלחו לאימות מחדש.',
          key: 'reprocess',
          duration: 4,
        });

        // Refresh the list immediately to update statistics and remove the deleted record
        await onSuccess();
      } else {
        message.error(result.error?.message || 'שגיאה בתיקון הרשומה');
      }
    } catch (error: any) {
      message.error(error.message || 'Failed to correct record');
    } finally {
      setLoading(false);
    }
  };

  if (!record) return null;

  return (
    <Modal
      title={
        <Space direction="vertical" size="small">
          <Title level={4} style={{ margin: 0 }}>תיקון רשומה לא תקינה</Title>
          <Text type="secondary">תקן את השדות שנכשלו באימות</Text>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="cancel" onClick={onClose}>
          ביטול
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={loading}
          onClick={handleSubmit}
        >
          תקן ושלח לעיבוד מחדש
        </Button>,
      ]}
    >
      {/* All Errors Corrected Success Indicator */}
      {allErrorsCorrected && (
        <Alert
          message="כל השגיאות תוקנו"
          description="כל השדות השגויים עודכנו. לחץ על 'תקן ושלח לעיבוד מחדש' לשליחה."
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Record Context */}
      <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
        <Descriptions.Item label="מקור נתונים">
          <Space>
            {record.dataSourceName}
            {record.dataSourceId && (
              <Tooltip title="ערוך הגדרות Schema">
                <Link
                  onClick={() => {
                    navigate(`/datasources/${record.dataSourceId}/edit`, {
                      state: { activeTab: 'schema' }
                    });
                    onClose();
                  }}
                  style={{ fontSize: 12 }}
                >
                  <EditOutlined /> ערוך Schema
                </Link>
              </Tooltip>
            )}
          </Space>
        </Descriptions.Item>
        <Descriptions.Item label="קובץ">{record.fileName}</Descriptions.Item>
        <Descriptions.Item label="שורה">{record.lineNumber || 'N/A'}</Descriptions.Item>
        <Descriptions.Item label="שגיאות">{failedFields.length}</Descriptions.Item>
      </Descriptions>

      {/* JSON Preview with live updates */}
      <div style={{ marginBottom: 16 }}>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          תצוגת JSON (שינויים מסומנים בירוק):
        </Text>
        {jsonPreview}
      </div>

      {/* Edit Form - Only Failed Fields with detailed error messages */}
      <Form
        form={form}
        layout="vertical"
        style={{ marginTop: 16 }}
        onValuesChange={(changedValues) => {
          const fieldName = Object.keys(changedValues)[0];
          handleFieldChange(fieldName, changedValues[fieldName]);
        }}
      >
        <Text strong style={{ color: '#ff4d4f', marginBottom: 16, display: 'block' }}>
          <WarningOutlined style={{ marginLeft: 4 }} />
          שדות שנכשלו באימות ({failedFields.length}):
        </Text>

        {failedFields.map(field => {
          const fieldSchema = schemaProperties[field.fieldName];
          console.log('Field lookup:', field.fieldName, 'Schema:', fieldSchema, 'All keys:', Object.keys(schemaProperties));
          const isEdited = editedValues[field.fieldName] !== undefined &&
                          editedValues[field.fieldName] !== field.originalValue;

          return (
            <div key={field.fieldName} style={{ marginBottom: 16 }}>
              <Form.Item
                name={field.fieldName}
                label={
                  <Space>
                    <Text strong style={{ color: isEdited ? '#52c41a' : '#ff4d4f' }}>
                      {field.fieldName}
                    </Text>
                    {isEdited && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                    <Tooltip title={field.translated.detailedMessage}>
                      <InfoCircleOutlined style={{ color: '#1890ff', cursor: 'help' }} />
                    </Tooltip>
                  </Space>
                }
                rules={[
                  { required: true, message: 'שדה חובה' },
                ]}
                help={
                  <Space direction="vertical" size={2} style={{ width: '100%' }}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      ערך מקורי: <code style={{ backgroundColor: '#f5f5f5', padding: '2px 4px' }}>{String(field.originalValue ?? 'ריק')}</code>
                    </Text>
                    <Text type="danger" style={{ fontSize: '12px' }}>
                      {field.translated.detailedMessage}
                    </Text>
                  </Space>
                }
                style={{ marginBottom: 8 }}
              >
                {/* Use Select for enum fields, Input for others */}
                {fieldSchema?.enum && fieldSchema.enum.length > 0 ? (
                  <Select
                    placeholder={`בחר ערך עבור ${field.fieldName}`}
                    style={{ borderColor: isEdited ? '#52c41a' : '#ff4d4f' }}
                    allowClear
                  >
                    {fieldSchema.enum.map((val, i) => (
                      <Select.Option key={i} value={val}>{val}</Select.Option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    placeholder={`הכנס ערך תקין עבור ${field.fieldName}`}
                    style={{ borderColor: isEdited ? '#52c41a' : '#ff4d4f' }}
                  />
                )}
              </Form.Item>

              {/* Schema Field Definition Display */}
              {fieldSchema && formatSchemaConstraint(fieldSchema, field.fieldName)}
            </div>
          );
        })}

        {failedFields.length === 0 && (
          <Text type="secondary">
            לא נמצאו שדות ספציפיים לתיקון. ייתכן שכל השגיאות הן כלליות ולא ניתנות לתיקון ידני.
          </Text>
        )}
      </Form>
    </Modal>
  );
};

export default EditRecordModal;
