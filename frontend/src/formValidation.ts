export interface ValidatedValue {
  value: string;
  error: string | null;
}

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/;
const controlCharacterPattern = /[\u0000-\u001f\u007f]/;

export function validateIdentifier(rawValue: string, label: string): ValidatedValue {
  const value = rawValue.trim();
  return identifierPattern.test(value)
    ? { value, error: null }
    : {
        value,
        error: `${label} must be 3 to 80 characters and use only letters, numbers, periods, underscores, or hyphens.`,
      };
}

export function validateText(
  rawValue: string,
  label: string,
  minimum: number,
  maximum: number,
): ValidatedValue {
  const value = rawValue.trim();
  const valid = value.length >= minimum && value.length <= maximum && !controlCharacterPattern.test(value);
  return valid
    ? { value, error: null }
    : { value, error: `${label} must be ${minimum} to ${maximum} characters without control characters.` };
}

export function validateCapabilityCsv(rawValue: string, label: string): ValidatedValue {
  if (rawValue.length > 600) {
    return { value: rawValue.trim(), error: `${label} must be 600 characters or fewer.` };
  }
  if (!rawValue.trim()) return { value: "", error: null };

  const values = rawValue.split(",").map((value) => value.trim());
  if (values.some((value) => !identifierPattern.test(value))) {
    return { value: values.join(","), error: `${label} must contain valid comma-separated IDs.` };
  }
  if (new Set(values).size !== values.length) {
    return { value: values.join(","), error: `${label} cannot contain duplicate IDs.` };
  }
  return { value: values.join(","), error: null };
}
