import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Space, message, Typography, Spin, Alert } from 'antd';
import { SaveOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { type JSONSchema } from 'jsonjoy-builder';
import { SchemaBuilderNew } from './SchemaBuilderNew';
import axios from 'axios';

const { Title } = Typography;

interface SchemaData {
  id: string;
  name: string;
  displayName: string;
  description: string;
  jsonSchemaContent: string;
  dataSourceId?: string;
  tags: string[];
  status: number;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const SchemaEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [schema, setSchema] = useState<JSONSchema>({});
  const [schemaData, setSchemaData] = useState<SchemaData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  // Fetch schema from API
  useEffect(() => {
    const fetchSchema = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        const response = await axios.get(`/api/v1/schema/${id}`);
        
        if (response.data.isSuccess && response.data.data) {
          const apiData = response.data.data;
          // Map PascalCase to camelCase
          const data: SchemaData = {
            id: apiData.ID,
            name: apiData.Name,
            displayName: apiData.DisplayName,
            description: apiData.Description,
            jsonSchemaContent: apiData.JsonSchemaContent,
            dataSourceId: apiData.DataSourceId,
            tags: apiData.Tags || [],
            status: apiData.Status,
            version: apiData.Version,
            createdBy: apiData.CreatedBy,
            createdAt: apiData.CreatedAt,
            updatedAt: apiData.UpdatedAt
          };
          setSchemaData(data);
          
          // Parse JSON schema content
          try {
            const parsedSchema = JSON.parse(data.jsonSchemaContent || '{}');
            setSchema(parsedSchema);
          } catch (parseError) {
            console.error('Error parsing JSON schema:', parseError);
            setSchema({});
          }
        } else {
          setError('Failed to load schema');
        }
      } catch (err) {
        console.error('Error fetching schema:', err);
        setError('Error loading schema from server');
      } finally {
        setLoading(false);
      }
    };

    fetchSchema();
  }, [id]);

  // Handle schema changes
  const handleSchemaChange = (newSchema: JSONSchema) => {
    setSchema(newSchema);
    setHasChanges(true);
  };

  // Save schema to API
  const handleSave = async () => {
    if (!id || !schemaData) {
      message.error('Cannot save: Schema data missing');
      return;
    }

    try {
      setSaving(true);
      
      const updatePayload = {
        displayName: schemaData.displayName,
        description: schemaData.description,
        dataSourceId: schemaData.dataSourceId,
        jsonSchemaContent: JSON.stringify(schema, null, 2),
        tags: schemaData.tags || [],
        status: schemaData.status,
        updatedBy: 'User'
      };

      const response = await axios.put(
        `/api/v1/schema/${id}`,
        updatePayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );

      if (response.data.isSuccess) {
        message.success('Schema saved successfully');
        setHasChanges(false);
        
        // Update local schema data with response
        if (response.data.data) {
          setSchemaData(response.data.data);
        }
      } else {
        message.error(response.data.error?.message || 'Failed to save schema');
      }
    } catch (err: any) {
      console.error('Error saving schema:', err);
      message.error(err.response?.data?.error?.message || 'Error saving schema to server');
    } finally {
      setSaving(false);
    }
  };

  // Handle back navigation
  const handleBack = () => {
    if (hasChanges) {
      const confirmed = window.confirm('יש לך שינויים שלא נשמרו. האם אתה בטוח שברצונך לצאת?');
      if (!confirmed) return;
    }
    navigate('/schema');
  };

  // Handle back to list
  const handleBackToList = () => {
    navigate('/schema');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <Spin size="large" tip="Loading schema..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message="Error Loading Schema"
          description={error}
          type="error"
          showIcon
          action={
            <Space>
              <Button onClick={() => window.location.reload()}>Retry</Button>
              <Button onClick={handleBack}>Go Back</Button>
            </Space>
          }
        />
      </div>
    );
  }

  if (!id) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message="No Schema Selected"
          description="Please select a schema to edit"
          type="warning"
          showIcon
          action={<Button onClick={handleBack}>Go to Schema List</Button>}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={handleBackToList}>
              חזור לרשימה
            </Button>
            <div>
              <Title level={4} style={{ margin: 0 }}>
                {schemaData?.displayName || 'Edit Schema'}
              </Title>
              <div style={{ color: '#8c8c8c', fontSize: '12px' }}>
                {schemaData?.name} • גרסה {schemaData?.version}
                {hasChanges && <span style={{ color: '#faad14', marginLeft: 8 }}>• שינויים שלא נשמרו</span>}
              </div>
            </div>
          </Space>
          <Space>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={saving}
              disabled={!hasChanges}
            >
              {saving ? 'שומר...' : 'שמור שינויים'}
            </Button>
          </Space>
        </div>
      </Card>

      {/* JSON Schema Editor */}
      <Card style={{ minHeight: '600px' }}>
        <SchemaBuilderNew
          initialSchema={schema}
          onChange={handleSchemaChange}
          height="650px"
        />
      </Card>

      {/* Save reminder at bottom */}
      {hasChanges && (
        <Card style={{ marginTop: 16, backgroundColor: '#fffbe6', borderColor: '#ffe58f' }}>
          <Space>
            <span style={{ color: '#faad14' }}>⚠️ יש לך שינויים שלא נשמרו</span>
            <Button
              type="primary"
              size="small"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={saving}
            >
              שמור עכשיו
            </Button>
          </Space>
        </Card>
      )}
    </div>
  );
};

export default SchemaEditorPage;
