import React, { useState, useMemo } from 'react';
import { Button, Input, Typography, Avatar } from 'antd';
import {
  RobotOutlined,
  SendOutlined,
  BarChartOutlined,
  DatabaseOutlined,
  AlertOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Title } = Typography;
const { TextArea } = Input;

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: string;
}

const AIAssistant: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [inputValue, setInputValue] = useState('');

  // Mock conversation seeded from i18n so it switches with language.
  const messages_init = useMemo<Message[]>(() => [
    { id: '1', type: 'ai',   content: t('aiAssistant.greeting'),    timestamp: '2025-09-17 10:30:00' },
    { id: '2', type: 'user', content: t('aiAssistant.mock.q1'),     timestamp: '2025-09-17 10:31:15' },
    { id: '3', type: 'ai',   content: t('aiAssistant.mock.a1'),     timestamp: '2025-09-17 10:32:00' },
    { id: '4', type: 'user', content: t('aiAssistant.mock.q2'),     timestamp: '2025-09-17 10:33:20' },
    { id: '5', type: 'ai',   content: t('aiAssistant.mock.a2'),     timestamp: '2025-09-17 10:34:10' },
  ], [t]);

  const [messages, setMessages] = useState<Message[]>(messages_init);

  const quickActions = [
    { label: t('aiAssistant.actions.todayMetrics'),   icon: <BarChartOutlined /> },
    { label: t('aiAssistant.actions.errorDashboard'), icon: <AlertOutlined /> },
    { label: t('aiAssistant.actions.qualityTrends'),  icon: <DatabaseOutlined /> },
  ];

  const handleSendMessage = () => {
    if (inputValue.trim()) {
      const newMessage: Message = {
        id: Date.now().toString(),
        type: 'user',
        content: inputValue,
        timestamp: new Date().toLocaleString(i18n.language),
      };
      setMessages([...messages, newMessage]);
      setInputValue('');

      // Simulate AI response
      setTimeout(() => {
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          type: 'ai',
          content: t('aiAssistant.mock.thinkingResponse'),
          timestamp: new Date().toLocaleString(i18n.language),
        };
        setMessages(prev => [...prev, aiResponse]);
      }, 1000);
    }
  };

  const handleQuickAction = (action: string) => {
    setInputValue(action);
  };

  return (
    <div className="ai-assistant-page">
      <div className="page-header">
        <div>
          <Title level={2} style={{ margin: 0 }}>
            {t('aiAssistant.title')}
          </Title>
        </div>
      </div>

      {/* Chat Interface - Mockup Style */}
      <div className="chat-container">
        {/* Dark Sidebar */}
        <div className="chat-sidebar">
          <div>
            <h3>{t('aiAssistant.heading')}</h3>
            <p>{t('aiAssistant.intro')}</p>
          </div>

          <div className="quick-actions">
            <strong>{t('aiAssistant.quickActions')}</strong>
            <div>
              {quickActions.map((action, index) => (
                <Button
                  key={index}
                  ghost
                  size="small"
                  onClick={() => handleQuickAction(action.label)}
                >
                  {action.icon} {action.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="connection-status">
            <strong>{t('aiAssistant.connectedLabel')}</strong>
            <div>
              <div>✅ MongoDB</div>
              <div>✅ Grafana</div>
              <div>✅ Prometheus</div>
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="chat-main">
          {/* Messages */}
          <div className="chat-messages">
            {messages.map((message) => (
              <div key={message.id} className={`message ${message.type}`}>
                <div className="message-bubble">
                  {message.type === 'ai' && (
                    <div style={{ marginBottom: 8 }}>
                      <Avatar size="small" icon={<RobotOutlined />} />
                    </div>
                  )}
                  <div className="message-content">{message.content}</div>
                  <div className="message-timestamp">{message.timestamp}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Chat Input */}
          <div className="chat-input">
            <TextArea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={t('aiAssistant.placeholder')}
              autoSize={{ minRows: 1, maxRows: 3 }}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSendMessage}
              disabled={!inputValue.trim()}
            >
              {t('aiAssistant.send')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
