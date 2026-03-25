/**
 * XmlTreePreview - Shows XML structure as a collapsible tree.
 * Per D-11: Tree view with collapsible nodes.
 */
import React, { useMemo } from 'react';
import { Tree } from 'antd';
import type { XmlTreeNode } from '../../../utils/fileAnalyzer/types';

interface XmlTreePreviewProps {
  treeData: XmlTreeNode[];
}

/**
 * Collect keys from the first 2 levels of the tree for default expansion.
 */
function getDefaultExpandedKeys(treeData: XmlTreeNode[], maxDepth = 2): string[] {
  const keys: string[] = [];
  function walk(nodes: XmlTreeNode[], depth: number) {
    if (depth >= maxDepth) return;
    for (const node of nodes) {
      keys.push(node.key);
      if (node.children) {
        walk(node.children, depth + 1);
      }
    }
  }
  walk(treeData, 0);
  return keys;
}

const XmlTreePreview: React.FC<XmlTreePreviewProps> = ({ treeData }) => {
  const defaultExpandedKeys = useMemo(() => getDefaultExpandedKeys(treeData), [treeData]);

  return (
    <Tree
      treeData={treeData}
      defaultExpandedKeys={defaultExpandedKeys}
      showLine
      selectable={false}
      style={{ padding: 8 }}
    />
  );
};

export default XmlTreePreview;
