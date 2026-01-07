import React from 'react';
import { Button, Result } from 'antd';
import { useTranslation } from 'react-i18next';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);

    this.setState({
      error,
      errorInfo
    });

    // TODO: Send to error tracking service (Sentry, etc.)
    // Example: logErrorToService(error, errorInfo);
  }

  reset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <ErrorFallback
          error={this.state.error}
          onReset={this.reset}
        />
      );
    }

    return this.props.children;
  }
}

// Functional component for error display
interface ErrorFallbackProps {
  error: Error | null;
  onReset: () => void;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, onReset }) => {
  const { t, i18n } = useTranslation();
  const isHebrew = i18n.language === 'he';

  return (
    <div style={{
      padding: '50px 20px',
      textAlign: 'center',
      minHeight: '400px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <Result
        status="error"
        title={isHebrew ? 'אירעה שגיאה' : 'An Error Occurred'}
        subTitle={error?.message || (isHebrew ? 'שגיאה לא צפויה' : 'Unexpected error')}
        extra={[
          <Button type="primary" onClick={onReset} key="reset">
            {isHebrew ? 'נסה שוב' : 'Try Again'}
          </Button>,
          <Button onClick={() => window.location.href = '/'} key="home">
            {isHebrew ? 'חזור לדף הבית' : 'Go Home'}
          </Button>
        ]}
      />
    </div>
  );
};

// HOC for wrapping functional components with error boundary
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ReactNode
) => {
  return (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );
};
