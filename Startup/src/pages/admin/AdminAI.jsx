import React from 'react';
import { Cpu } from 'lucide-react';
import EmptyState from '../../components/admin/EmptyState';

export const AdminAI = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 className="text-xl font-bold text-white" style={{ margin: 0, fontSize: '1.5rem' }}>AI Model Monitor</h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: '#9ca3af' }}>Monitor LLM status, model parameters, API latency, and prompt settings.</p>
      </div>

      <EmptyState 
        title="No AI monitoring data available"
        description="MindSync AI integration endpoints and LLM logs have no dedicated administrator status hook. All models run directly in user study namespaces."
        icon={Cpu}
      />
    </div>
  );
};

export default AdminAI;
