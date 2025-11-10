import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_SCHEMA_API_URL || 'http://localhost:5001/api/v1/schema';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export class SchemaApiClient {
  async getSchemas(params = {}) {
    const response = await apiClient.get('', { params });
    return response.data;
  }

  async getSchema(id: string) {
    const response = await apiClient.get(`/${id}`);
    return response.data;
  }

  async createSchema(request: any) {
    const response = await apiClient.post('', request);
    return response.data;
  }

  async updateSchema(id: string, request: any) {
    const response = await apiClient.put(`/${id}`, request);
    return response.data;
  }

  async deleteSchema(id: string) {
    const response = await apiClient.delete(`/${id}`);
    return response.data;
  }

  async validateSampleData(id: string, data: object) {
    const response = await apiClient.post(`/${id}/validate`, data);
    return response.data;
  }

  async getTemplates() {
    const response = await apiClient.get('/templates');
    return response.data;
  }
}

export const schemaApiClient = new SchemaApiClient();
