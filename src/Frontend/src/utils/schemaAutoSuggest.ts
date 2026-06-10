/**
 * Schema Auto-Suggest Utility
 * Suggests constraints and formats based on field names
 */

interface ConstraintSuggestion {
  constraint: string;
  value: any;
  reason: string;
  reasonHebrew: string;
  confidence: 'high' | 'medium' | 'low';
}

interface FieldSuggestions {
  fieldName: string;
  type?: string;
  format?: string;
  pattern?: string;
  constraints: ConstraintSuggestion[];
}

/**
 * Suggest schema properties based on field name
 */
export function suggestConstraintsForField(fieldName: string): FieldSuggestions {
  const suggestions: FieldSuggestions = {
    fieldName,
    constraints: []
  };

  const nameLower = fieldName.toLowerCase();

  // Email fields
  if (nameLower.includes('email') || nameLower.includes('דוא') || nameLower.includes('מייל')) {
    suggestions.type = 'string';
    suggestions.format = 'email';
    suggestions.constraints.push({
      constraint: 'format',
      value: 'email',
      reason: 'Field name suggests email address',
      reasonHebrew: 'שם השדה מרמז על כתובת אימייל',
      confidence: 'high'
    });
  }

  // Phone fields
  if (nameLower.includes('phone') || nameLower.includes('טלפון') || nameLower.includes('פלאפון')) {
    suggestions.type = 'string';
    suggestions.pattern = '^05\\d{8}$';
    suggestions.constraints.push({
      constraint: 'pattern',
      value: '^05\\d{8}$',
      reason: 'Israeli phone number format',
      reasonHebrew: 'פורמט מספר טלפון ישראלי',
      confidence: 'high'
    });
    suggestions.constraints.push({
      constraint: 'minLength',
      value: 10,
      reason: 'Phone numbers are typically 10 digits',
      reasonHebrew: 'מספרי טלפון בדרך כלל 10 ספרות',
      confidence: 'medium'
    });
  }

  // ID number fields
  if (nameLower.includes('id') && (nameLower.includes('תעודת') || nameLower.includes('זהות'))) {
    suggestions.type = 'string';
    suggestions.pattern = '^\\d{9}$';
    suggestions.constraints.push({
      constraint: 'pattern',
      value: '^\\d{9}$',
      reason: 'Israeli ID number is 9 digits',
      reasonHebrew: 'תעודת זהות ישראלית היא 9 ספרות',
      confidence: 'high'
    });
    suggestions.constraints.push({
      constraint: 'minLength',
      value: 9,
      reason: 'ID must be exactly 9 digits',
      reasonHebrew: 'ת"ז חייבת להיות בדיוק 9 ספרות',
      confidence: 'high'
    });
    suggestions.constraints.push({
      constraint: 'maxLength',
      value: 9,
      reason: 'ID must be exactly 9 digits',
      reasonHebrew: 'ת"ז חייבת להיות בדיוק 9 ספרות',
      confidence: 'high'
    });
  }

  // Date fields
  if (nameLower.includes('date') || nameLower.includes('תאריך')) {
    suggestions.type = 'string';
    suggestions.format = 'date';
    suggestions.constraints.push({
      constraint: 'format',
      value: 'date',
      reason: 'Field name suggests date value',
      reasonHebrew: 'שם השדה מרמז על ערך תאריך',
      confidence: 'high'
    });
  }

  // Age fields
  if (nameLower.includes('age') || nameLower.includes('גיל')) {
    suggestions.type = 'integer';
    suggestions.constraints.push({
      constraint: 'minimum',
      value: 0,
      reason: 'Age cannot be negative',
      reasonHebrew: 'גיל לא יכול להיות שלילי',
      confidence: 'high'
    });
    suggestions.constraints.push({
      constraint: 'maximum',
      value: 120,
      reason: 'Reasonable maximum age',
      reasonHebrew: 'גיל מקסימלי סביר',
      confidence: 'medium'
    });
  }

  // Price/Amount fields
  if (nameLower.includes('price') || nameLower.includes('מחיר') || 
      nameLower.includes('amount') || nameLower.includes('סכום') ||
      nameLower.includes('cost') || nameLower.includes('עלות')) {
    suggestions.type = 'number';
    suggestions.constraints.push({
      constraint: 'minimum',
      value: 0,
      reason: 'Price cannot be negative',
      reasonHebrew: 'מחיר לא יכול להיות שלילי',
      confidence: 'high'
    });
    suggestions.constraints.push({
      constraint: 'multipleOf',
      value: 0.01,
      reason: 'Two decimal places for currency',
      reasonHebrew: 'שני מקומות עשרוניים למטבע',
      confidence: 'medium'
    });
  }

  // Quantity/Count fields
  if (nameLower.includes('quantity') || nameLower.includes('כמות') ||
      nameLower.includes('count') || nameLower.includes('מספר')) {
    suggestions.type = 'integer';
    suggestions.constraints.push({
      constraint: 'minimum',
      value: 0,
      reason: 'Quantity cannot be negative',
      reasonHebrew: 'כמות לא יכולה להיות שלילית',
      confidence: 'high'
    });
  }

  // Percentage fields
  if (nameLower.includes('percent') || nameLower.includes('אחוז') || nameLower.includes('%')) {
    suggestions.type = 'number';
    suggestions.constraints.push({
      constraint: 'minimum',
      value: 0,
      reason: 'Percentage min 0%',
      reasonHebrew: 'אחוז מינימום 0%',
      confidence: 'high'
    });
    suggestions.constraints.push({
      constraint: 'maximum',
      value: 100,
      reason: 'Percentage max 100%',
      reasonHebrew: 'אחוז מקסימום 100%',
      confidence: 'high'
    });
  }

  // Name fields
  if (nameLower.includes('name') || nameLower.includes('שם')) {
    suggestions.type = 'string';
    suggestions.constraints.push({
      constraint: 'minLength',
      value: 2,
      reason: 'Names should be at least 2 characters',
      reasonHebrew: 'שמות צריכים להיות לפחות 2 תווים',
      confidence: 'high'
    });
  }

  // Address fields
  if (nameLower.includes('address') || nameLower.includes('כתובת')) {
    suggestions.type = 'string';
    suggestions.constraints.push({
      constraint: 'minLength',
      value: 5,
      reason: 'Address should be meaningful',
      reasonHebrew: 'כתובת צריכה להיות משמעותית',
      confidence: 'medium'
    });
  }

  // URL fields
  if (nameLower.includes('url') || nameLower.includes('link') || nameLower.includes('website')) {
    suggestions.type = 'string';
    suggestions.format = 'uri';
    suggestions.constraints.push({
      constraint: 'format',
      value: 'uri',
      reason: 'URL format validation',
      reasonHebrew: 'אימות פורמט URL',
      confidence: 'high'
    });
  }

  // UUID fields
  if (nameLower.includes('uuid') || (nameLower.includes('id') && nameLower.includes('unique'))) {
    suggestions.type = 'string';
    suggestions.format = 'uuid';
    suggestions.constraints.push({
      constraint: 'format',
      value: 'uuid',
      reason: 'UUID format',
      reasonHebrew: 'פורמט UUID',
      confidence: 'high'
    });
  }

  // Boolean flags
  if (nameLower.startsWith('is') || nameLower.startsWith('has') || 
      nameLower.startsWith('האם') || nameLower.includes('סטטוס')) {
    suggestions.type = 'boolean';
  }

  return suggestions;
}

/**
 * Get human-readable suggestion summary
 */
export function getSuggestionSummary(suggestions: FieldSuggestions): string {
  const parts: string[] = [];

  if (suggestions.type) {
    parts.push(`Type: ${suggestions.type}`);
  }

  if (suggestions.format) {
    parts.push(`Format: ${suggestions.format}`);
  }

  if (suggestions.pattern) {
    parts.push(`Pattern: ${suggestions.pattern}`);
  }

  if (suggestions.constraints.length > 0) {
    parts.push(`${suggestions.constraints.length} constraint suggestions`);
  }

  return parts.join(', ');
}

/**
 * Options for {@link applySuggestionsToSchema}.
 *
 * Phase 36 B2 fix: an OPTIONAL field whose name implies an asserted `format`
 * (e.g. `date`/`תאריך`) must tolerate an empty value. Without this, the
 * generator stamped an unconditional `format:'date'` and Corvus rejected the
 * `""` that `CsvToJsonConverter` emits for an empty cell — so an empty optional
 * date was wrongly invalid.
 */
export interface ApplySuggestionsOptions {
  /** When true, an asserted `format` is wrapped empty-tolerant (anyOf empty-or-format). */
  optional?: boolean;
}

/**
 * Apply suggestions to existing schema.
 *
 * @param options - When `optional` is true and the resulting schema asserts a `format`,
 *                   the property is emitted empty-tolerant as
 *                   `anyOf:[{type:'string',maxLength:0}, {<format branch>}]` (Phase 36 B2,
 *                   matching the 36-01 Corvus `TargetDateSchema`). Populated/required date
 *                   fields keep strict `format` enforcement (no regression).
 */
export function applySuggestionsToSchema(
  schema: any,
  suggestions: FieldSuggestions,
  options?: ApplySuggestionsOptions
): any {
  const updated = { ...schema };

  if (suggestions.type && !updated.type) {
    updated.type = suggestions.type;
  }

  if (suggestions.format && !updated.format) {
    updated.format = suggestions.format;
  }

  if (suggestions.pattern && !updated.pattern) {
    updated.pattern = suggestions.pattern;
  }

  // Apply high-confidence constraints
  const highConfidenceConstraints = suggestions.constraints.filter(c => c.confidence === 'high');
  for (const constraint of highConfidenceConstraints) {
    if (!updated[constraint.constraint]) {
      updated[constraint.constraint] = constraint.value;
    }
  }

  // B2: an optional field with an asserted format must permit an empty value.
  // Emit the 36-01 empty-tolerant shape: anyOf of an empty string OR the format-checked value.
  if (options?.optional && updated.format) {
    const formatBranch = { ...updated, type: 'string' };
    return {
      anyOf: [
        { type: 'string', maxLength: 0 },
        formatBranch,
      ],
    };
  }

  return updated;
}
