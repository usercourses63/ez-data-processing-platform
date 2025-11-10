import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Layout, theme } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import heIL from 'antd/locale/he_IL';
import enUS from 'antd/locale/en_US';
import './i18n';
import './App.css';

// Components
import AppHeader from './components/layout/AppHeader';
import AppSidebar from './components/layout/AppSidebar';
import RegexHelperProvider from './components/schema/RegexHelperProvider';
import Dashboard from './pages/Dashboard';
import DataSourceList from './pages/datasources/DataSourceList';
import DataSourceForm from './pages/datasources/DataSourceFormEnhanced';
import DataSourceEdit from './pages/datasources/DataSourceEditEnhanced';
import DataSourceDetails from './pages/datasources/DataSourceDetailsEnhanced';
import ValidationResults from './pages/validation/ValidationResults';
import SystemMonitoring from './pages/monitoring/SystemMonitoring';
import SchemaManagement from './pages/schema/SchemaManagementEnhanced';
import SchemaBuilder from './pages/schema/SchemaBuilderNew';
import SchemaEditorPage from './pages/schema/SchemaEditorPage';
import MetricsConfigurationListEnhanced from './pages/metrics/MetricsConfigurationListEnhanced';
import MetricConfigurationWizard from './pages/metrics/MetricConfigurationWizard';
import InvalidRecordsManagement from './pages/invalid-records/InvalidRecordsManagement';
import AIAssistant from './pages/ai-assistant/AIAssistant';
import NotificationsManagement from './pages/notifications/NotificationsManagement';

const { Content } = Layout;

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

const App: React.FC = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const antdLocale = isRTL ? heIL : enUS;

  return (
    <QueryClientProvider client={queryClient}>
    <ConfigProvider
      locale={antdLocale}
      direction={isRTL ? 'rtl' : 'ltr'}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          fontFamily: isRTL ? 'Rubik, sans-serif' : undefined,
          borderRadius: 6,
          
          // Mockup color palette
          colorPrimary: '#3498db',
          colorSuccess: '#27ae60',
          colorWarning: '#f39c12',
          colorError: '#e74c3c',
          colorInfo: '#3498db',
          
          // Background colors
          colorBgBase: '#ffffff',
          colorBgContainer: '#ffffff',
          colorBgElevated: '#ffffff',
          colorBgLayout: '#f5f5f5',
          
          // Text colors
          colorText: '#2c3e50',
          colorTextSecondary: '#7f8c8d',
          
          // Border colors
          colorBorder: '#e9ecef',
          colorBorderSecondary: '#dee2e6',
        },
      }}
    >
      <RegexHelperProvider>
        <Router>
          <Layout className={`app-layout ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
          <AppHeader />
          <Layout>
            <AppSidebar />
            <Layout className="app-content-layout">
              <Content className="app-content">
                <Routes>
                  <Route path="/" element={<Navigate to="/datasources" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/datasources" element={<DataSourceList />} />
                  <Route path="/datasources/new" element={<DataSourceForm />} />
                  <Route path="/datasources/:id/edit" element={<DataSourceEdit />} />
                  <Route path="/datasources/:id" element={<DataSourceDetails />} />
                  <Route path="/schema-management" element={<SchemaManagement />} />
                  <Route path="/schema" element={<SchemaManagement />} />
                  <Route path="/schema/builder" element={<SchemaBuilder />} />
                  <Route path="/schema/edit/:id" element={<SchemaEditorPage />} />
                  <Route path="/metrics-config" element={<MetricsConfigurationListEnhanced />} />
                  <Route path="/metrics" element={<MetricsConfigurationListEnhanced />} />
                  <Route path="/metrics/new" element={<MetricConfigurationWizard />} />
                  <Route path="/metrics/create" element={<MetricConfigurationWizard />} />
                  <Route path="/metrics/:id/edit" element={<MetricConfigurationWizard />} />
                  <Route path="/metrics/edit/:id" element={<MetricConfigurationWizard />} />
                  <Route path="/invalid-records" element={<InvalidRecordsManagement />} />
                  <Route path="/ai-assistant" element={<AIAssistant />} />
                  <Route path="/notifications" element={<NotificationsManagement />} />
                  <Route path="/validation" element={<ValidationResults />} />
                  <Route path="/monitoring" element={<SystemMonitoring />} />
                  <Route path="*" element={<Navigate to="/datasources" replace />} />
                </Routes>
              </Content>
            </Layout>
          </Layout>
        </Layout>
      </Router>
      </RegexHelperProvider>
    </ConfigProvider>
    </QueryClientProvider>
  );
};

export default App;
