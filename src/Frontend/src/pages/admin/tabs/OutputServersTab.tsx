/**
 * OutputServersTab - Output Servers Management
 * v0.2.0: Thin wrapper for ServerListTab with direction='output'
 * Shows servers with Direction=Output or Direction=Both
 */
import React from 'react';
import ServerListTab from './ServerListTab';

const OutputServersTab: React.FC = () => {
  return <ServerListTab direction="output" />;
};

export default OutputServersTab;
