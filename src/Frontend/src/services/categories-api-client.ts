/**
 * API Client for managing datasource categories
 * BETA Release - Category Management Feature
 */

const API_BASE_URL = 'http://localhost:5001';

export interface DataSourceCategory {
  ID: string;
  Name: string;
  NameEn: string;
  Description?: string;
  SortOrder: number;
  IsActive: boolean;
  CreatedAt: string;
  UpdatedAt: string;
  CreatedBy?: string;
  ModifiedBy?: string;
}

export interface CreateCategoryRequest {
  Name: string;
  NameEn: string;
  Description?: string;
  SortOrder?: number;
  IsActive?: boolean;
}

export interface UpdateCategoryRequest {
  Name: string;
  NameEn: string;
  Description?: string;
  SortOrder: number;
  IsActive: boolean;
}

export interface ReorderCategoriesRequest {
  CategoryIds: string[];
}

/**
 * Get all categories
 * @param includeInactive - Whether to include inactive categories
 * @returns List of categories
 */
export const getAllCategories = async (includeInactive: boolean = false): Promise<DataSourceCategory[]> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/categories?includeInactive=${includeInactive}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'שגיאה באחזור קטגוריות');
  }

  return response.json();
};

/**
 * Get a category by ID
 * @param id - Category ID
 * @returns Category
 */
export const getCategoryById = async (id: string): Promise<DataSourceCategory> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/categories/${id}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'שגיאה באחזור קטגוריה');
  }

  return response.json();
};

/**
 * Create a new category
 * @param category - Category data
 * @returns Created category
 */
export const createCategory = async (category: CreateCategoryRequest): Promise<DataSourceCategory> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/categories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(category),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'שגיאה ביצירת קטגוריה');
  }

  return response.json();
};

/**
 * Update an existing category
 * @param id - Category ID
 * @param category - Updated category data
 * @returns Updated category
 */
export const updateCategory = async (id: string, category: UpdateCategoryRequest): Promise<DataSourceCategory> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/categories/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(category),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'שגיאה בעדכון קטגוריה');
  }

  return response.json();
};

/**
 * Delete a category
 * @param id - Category ID
 */
export const deleteCategory = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/categories/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'שגיאה במחיקת קטגוריה');
  }
};

/**
 * Reorder categories
 * @param categoryIds - Ordered list of category IDs
 */
export const reorderCategories = async (categoryIds: string[]): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/categories/reorder`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({ CategoryIds: categoryIds }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'שגיאה בסידור מחדש של קטגוריות');
  }
};

/**
 * Toggle category active status
 * @param id - Category ID
 * @param isActive - New active status
 * @returns Updated category
 */
export const toggleCategoryActive = async (id: string, isActive: boolean): Promise<DataSourceCategory> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/categories/${id}/toggle-active?isActive=${isActive}`, {
    method: 'PATCH',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'שגיאה בשינוי סטטוס קטגוריה');
  }

  return response.json();
};

export interface CategoryUsageInfo {
  categoryId: string;
  categoryName: string;
  usageCount: number;
  canHardDelete: boolean;
}

/**
 * Get datasource usage count for a category
 * @param id - Category ID
 * @returns Usage information
 */
export const getCategoryUsageCount = async (id: string): Promise<CategoryUsageInfo> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/categories/${id}/usage-count`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'שגיאה בקבלת מידע על שימוש');
  }

  return response.json();
};
