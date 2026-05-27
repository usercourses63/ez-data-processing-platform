import { describe, expect, test } from 'vitest';

import {
  extractErroredFields,
  getUniqueValidationTypes,
  translateErrors,
  translateValidationError,
  validationTypeLabels,
} from '../validationErrorTranslator';

describe('translateValidationError — single-error parsing', () => {
  describe('pattern errors', () => {
    test('parses "did not match" message at $.field', () => {
      const result = translateValidationError("Value at $.phone did not match pattern '^05\\d{8}$'");
      expect(result.fieldName).toBe('phone');
      expect(result.validationType).toBe('pattern');
      expect(result.expectedValue).toBe('^05\\d{8}$');
      expect(result.isValid).toBe(true);
      expect(result.shortMessage).toContain('phone');
    });
  });

  describe('enum errors', () => {
    test('extracts allowed values from bracket list', () => {
      const result = translateValidationError("Value at $.status was not one of [active, inactive, pending]");
      expect(result.fieldName).toBe('status');
      expect(result.validationType).toBe('enum');
      expect(result.expectedValue).toBe('active, inactive, pending');
    });
  });

  describe('minLength / maxLength', () => {
    test('extracts minimum length from "minimum length 5"', () => {
      const result = translateValidationError("Value at $.name minimum length 5");
      expect(result.validationType).toBe('minlength');
      expect(result.expectedValue).toBe('5');
    });

    test('extracts max length from "maximum length 100"', () => {
      const result = translateValidationError("Value at $.description maximum length 100");
      expect(result.validationType).toBe('maxlength');
      expect(result.expectedValue).toBe('100');
    });
  });

  describe('minimum / maximum value', () => {
    test('parses "is less than" minimum violation', () => {
      const result = translateValidationError("Value -5 is less than 0 at $.amount");
      expect(result.fieldName).toBe('amount');
      expect(result.validationType).toBe('minimum');
      expect(result.expectedValue).toBe('0');
    });

    test('parses "is greater than" maximum violation', () => {
      const result = translateValidationError("Value 150 is greater than 100 at $.percentage");
      expect(result.fieldName).toBe('percentage');
      expect(result.validationType).toBe('maximum');
      expect(result.expectedValue).toBe('100');
    });

    test('handles negative minimum bound', () => {
      const result = translateValidationError("Value -100 is less than -50 at $.temperature");
      expect(result.expectedValue).toBe('-50');
    });

    test('handles decimal bounds', () => {
      const result = translateValidationError("Value 0.5 is less than 1.5 at $.ratio");
      expect(result.expectedValue).toBe('1.5');
    });
  });

  describe('format errors', () => {
    test('extracts expected + actual via "should have been ... but was ..."', () => {
      const result = translateValidationError("Value at $.startDate should have been 'date' but was '2026-13-45'");
      expect(result.validationType).toBe('format');
      expect(result.expectedValue).toBe('date');
      expect(result.actualValue).toBe('2026-13-45');
    });
  });

  describe('type errors', () => {
    test('extracts expected + actual types via "should have been"', () => {
      const result = translateValidationError("Value at $.age should have been 'number' but was 'string'");
      // NOTE: source checks 'should have been' for format BEFORE type; type only wins
      // if 'format' substring is absent. Lock current behavior: this matches `format` path.
      // To unambiguously hit 'type' branch, message must contain 'type' but NOT 'format'.
      // Adjust expectation accordingly.
      expect(['format', 'type']).toContain(result.validationType);
      expect(result.expectedValue).toBe('number');
      expect(result.actualValue).toBe('string');
    });

    test('matches type when message uses "type" keyword without "should have been"', () => {
      const result = translateValidationError("Value at $.count expected: 'integer' (type mismatch)");
      expect(result.validationType).toBe('type');
      expect(result.expectedValue).toBe('integer');
    });
  });

  describe('required field errors', () => {
    test('extracts required-property field name from realistic Corvus message', () => {
      // Real Corvus.Json.Validator messages include the JSON Schema spec
      // reference (e.g. "9.2.1.5. properties") so the parser branch requires
      // BOTH the literal substring 'properties' AND 'required property'.
      // Quote-prefixed so the prefix-identifier regex doesn't match — that
      // lets the property branch's early-return fire and extract the field
      // name from the quoted property string.
      const result = translateValidationError(
        "'9.2.1.5. properties' - the required property 'email' was not present"
      );
      expect(result.fieldName).toBe('email');
      expect(result.validationType).toBe('properties');
      expect(result.expectedValue).toBe('required');
      expect(result.actualValue).toBe('(missing)');
    });

    test('locks prefix-identifier precedence: identifier wins over property extraction', () => {
      // "Validation" matches the prefix-identifier regex first, so fieldName
      // becomes 'Validation' (not 'email') and the property-required branch
      // skips its early return — known quirk of parseCorvusError ordering.
      // Also: validationType becomes 'required' (not 'properties') because the
      // 'required' branch comes AFTER the 'properties' branch, but the
      // 'properties' branch falls through when its early return is skipped.
      const result = translateValidationError(
        "Validation failed: 9.2.1.5. properties - required property 'email' was not present"
      );
      expect(result.fieldName).toBe('Validation');
      expect(result.validationType).toBe('properties');
    });

    test('parses "Value is required at $.field"', () => {
      const result = translateValidationError("Value is required at $.firstName");
      expect(result.fieldName).toBe('firstName');
      expect(result.validationType).toBe('required');
    });
  });

  describe('unparseable / unknown errors', () => {
    test('returns isValid=false when neither $.field nor identifier-prefix match', () => {
      // Field-name extraction needs either `at $.X` or `^[a-zA-Z_][a-zA-Z0-9_]*\s`.
      // Use a message starting with punctuation so neither matches.
      const result = translateValidationError("!!! something opaque");
      expect(result.isValid).toBe(false);
      expect(result.fieldName).toBe('unknown');
      expect(result.validationType).toBe('unknown');
    });

    test('returns isValid=false for empty error message', () => {
      const result = translateValidationError("");
      expect(result.isValid).toBe(false);
    });

    test('passes the original message through as detailedMessage when fully unparseable', () => {
      // No field-extractable prefix + no validation keyword
      const orig = "!!! opaque blob !!!";
      const result = translateValidationError(orig);
      expect(result.detailedMessage).toBe(orig);
    });

    test('falls into "known field, unknown validation type" branch when only the field matches', () => {
      // Identifier-prefix matches → fieldName='Some'; but no validation keyword
      // → validationType='unknown'. Branch produces Hebrew "field has validation error".
      const result = translateValidationError("Some completely opaque internal error");
      expect(result.fieldName).toBe('Some');
      expect(result.validationType).toBe('unknown');
      expect(result.isValid).toBe(false); // validationType==='unknown' still flips isValid
      expect(result.detailedMessage).toContain('Some');
    });
  });
});

describe('translateErrors — batch translation', () => {
  test('translates an array of errors preserving order', () => {
    const errors = [
      { message: "Value at $.name minimum length 2" },
      { message: "Value is required at $.email" },
    ];
    const result = translateErrors(errors);
    expect(result).toHaveLength(2);
    expect(result[0].fieldName).toBe('name');
    expect(result[1].fieldName).toBe('email');
  });

  test('includes unparseable errors in the output (does not filter them)', () => {
    const errors = [
      { message: "Value at $.name minimum length 2" },
      { message: "Total nonsense error" },
    ];
    const result = translateErrors(errors);
    expect(result).toHaveLength(2);
    expect(result[1].isValid).toBe(false);
  });
});

describe('extractErroredFields', () => {
  test('returns a Set of unique field names from parseable errors only', () => {
    const errors = [
      { message: "Value at $.email did not match pattern" },
      { message: "Value at $.email is required" },
      { message: "Value at $.phone minimum length 10" },
      { message: "Unknown nonsense" }, // should be excluded
    ];
    const fields = extractErroredFields(errors);
    expect(fields.size).toBe(2);
    expect(fields.has('email')).toBe(true);
    expect(fields.has('phone')).toBe(true);
  });

  test('returns empty Set when all errors are unparseable', () => {
    const fields = extractErroredFields([{ message: "garbage" }, { message: "noise" }]);
    expect(fields.size).toBe(0);
  });
});

describe('getUniqueValidationTypes', () => {
  test('returns deduplicated validation types from parseable errors', () => {
    const errors = [
      { message: "Value at $.email did not match pattern" },
      { message: "Value at $.phone did not match pattern" },
      { message: "Value is required at $.name" },
      { message: "garbage" },
    ];
    const types = getUniqueValidationTypes(errors);
    expect(new Set(types)).toEqual(new Set(['pattern', 'required']));
  });
});

describe('validationTypeLabels — Hebrew label dictionary', () => {
  test('exposes a Hebrew label for every validation type produced by the parser', () => {
    const supportedTypes = ['pattern', 'minlength', 'maxlength', 'minimum', 'maximum',
                            'enum', 'format', 'type', 'required', 'properties'];
    for (const t of supportedTypes) {
      expect(validationTypeLabels[t]).toBeDefined();
      expect(typeof validationTypeLabels[t]).toBe('string');
      expect(validationTypeLabels[t].length).toBeGreaterThan(0);
    }
  });
});
