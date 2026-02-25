import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Layout, theme } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import heIL from 'antd/locale/he_IL';
import enUS from 'antd/locale/en_US';
import './i18n';
import './App.css';

// Layout components (keep these synchronous)
import SplashScreen from './components/SplashScreen';
import AppHeader from './components/layout/AppHeader';
import AppSidebar from './components/layout/AppSidebar';
import AppFooter from './components/layout/AppFooter';
import RegexHelperProvider from './components/schema/RegexHelperProvider';
import { LoadingState, ErrorBoundary } from './components/shared';

// Lazy load all page components for code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const DataSourceList = lazy(() => import('./pages/datasources/DataSourceList'));
const DataSourceForm = lazy(() => import('./pages/datasources/DataSourceFormEnhanced'));
const DataSourceEdit = lazy(() => import('./pages/datasources/DataSourceEditEnhanced'));
const DataSourceDetails = lazy(() => import('./pages/datasources/DataSourceDetailsEnhanced'));
const ValidationResults = lazy(() => import('./pages/validation/ValidationResults'));
const SystemMonitoring = lazy(() => import('./pages/monitoring/SystemMonitoring'));
const SchemaManagement = lazy(() => import('./pages/schema/SchemaManagementEnhanced'));
const SchemaBuilder = lazy(() => import('./pages/schema/SchemaBuilderNew'));
const SchemaEditorPage = lazy(() => import('./pages/schema/SchemaEditorPage'));
const MetricConfigurationWizard = lazy(() => import('./pages/metrics/MetricConfigurationWizard'));
const AlertsManagement = lazy(() => import('./pages/alerts/AlertsManagement'));
const InvalidRecordsManagement = lazy(() => import('./pages/invalid-records/InvalidRecordsManagement'));
const AIAssistant = lazy(() => import('./pages/ai-assistant/AIAssistant'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const HelpPage = lazy(() => import('./pages/help/HelpPage'));

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

  // Sync document direction with language (Phase 11 RTL fix)
  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [isRTL, i18n.language]);

  // Check if splash screen was already shown in this session
  const [showSplash, setShowSplash] = useState(() => {
    return !sessionStorage.getItem('ez-splash-shown');
  });

  // Handle splash screen finish
  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  // Show splash screen on first load only
  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} duration={2500} />;
  }

  return (
    <ErrorBoundary>
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
                <Suspense fallback={<LoadingState type="page" />}>
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
                    <Route path="/metrics/new" element={<MetricConfigurationWizard />} />
                    <Route path="/metrics/create" element={<MetricConfigurationWizard />} />
                    <Route path="/metrics/:id/edit" element={<MetricConfigurationWizard />} />
                    <Route path="/metrics/edit/:id" element={<MetricConfigurationWizard />} />
                    <Route path="/alerts" element={<AlertsManagement />} />
                    <Route path="/invalid-records" element={<InvalidRecordsManagement />} />
                    <Route path="/ai-assistant" element={<AIAssistant />} />
                    <Route path="/validation" element={<ValidationResults />} />
                    <Route path="/monitoring" element={<SystemMonitoring />} />
                    <Route path="/admin/settings" element={<AdminSettings />} />
                    <Route path="/help" element={<HelpPage />} />
                    <Route path="*" element={<Navigate to="/datasources" replace />} />
                  </Routes>
                </Suspense>
              </Content>
              <AppFooter />
            </Layout>
          </Layout>
        </Layout>
      </Router>
      </RegexHelperProvider>
    </ConfigProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
