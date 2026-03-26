import { useEffect } from 'react';
import { getDocsBaseUrl } from '../../utils/docs-url';

const HelpPage: React.FC = () => {
  useEffect(() => {
    // Redirect to Docusaurus Hebrew user guide
    const docsUrl = `${getDocsBaseUrl()}/docs/user-guide/`;
    window.location.href = docsUrl;
  }, []);

  return null;
};

export default HelpPage;
