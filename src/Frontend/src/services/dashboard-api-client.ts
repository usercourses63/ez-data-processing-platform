const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export interface DashboardOverview {
  TotalFiles: number;
  ValidRecords: number;
  InvalidRecords: number;
  ErrorRate: number;
  CalculatedAt: string;
}

/**
 * Get dashboard overview statistics
 */
export const getDashboardOverview = async (): Promise<DashboardOverview> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/dashboard/overview`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch dashboard overview: ${response.statusText}`);
  }
  
  return response.json();
};
