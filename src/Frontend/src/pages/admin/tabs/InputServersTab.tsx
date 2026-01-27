/**
 * InputServersTab - Input Servers Management
 * v0.2.0: Thin wrapper for ServerListTab with direction='input'
 * Shows servers with Direction=Input or Direction=Both
 */
import React from 'react';
import ServerListTab from './ServerListTab';

const InputServersTab: React.FC = () => {
  return <ServerListTab direction="input" />;
};

export default InputServersTab;
