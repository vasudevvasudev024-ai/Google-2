const SENSITIVE_KEY_PATTERN =
  /^(api_?key|secret|secret_?key|password|passwd|private_?key|access_?token|refresh_?token|client_?secret|auth_?token|bearer_?token|authorization|credential_?value)$/i;

const SECRET_VALUE_PATTERNS: RegExp[] = [
  /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /\bsk-(?:proj-|live-|test-)?[A-Za-z0-9_-]{16,}\b/g,
  /\bAIza[0-9A-Za-z\-_]{20,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /-----BEGIN\s+(?:RSA\s+|EC\s+|OPENSSH\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+|EC\s+|OPENSSH\s+)?PRIVATE\s+KEY-----/g,
];

const ENV_VAR_NAME_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;

export function isSafeEnvVarName(value: string): boolean {
  if (!ENV_VAR_NAME_PATTERN.test(value)) {
    return false;
  }
  // Reject values that look like actual inline secrets even if uppercase
  if (/^(AKIA[0-9A-Z]{16}|AIZA[0-9A-Z_]{20,})$/.test(value)) {
    return false;
  }
  return true;
}

export function detectSecretLeaks(value: unknown, path = '$'): string[] {
  const issues: string[] = [];

  if (typeof value === 'string') {
    for (const pattern of SECRET_VALUE_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(value)) {
        issues.push(`Secret token pattern detected at ${path}.`);
      }
    }
    return issues;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      issues.push(...detectSecretLeaks(item, `${path}[${index}]`));
    });
    return issues;
  }

  if (value && typeof value === 'object') {
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const nextPath = `${path}.${key}`;
      if (SENSITIVE_KEY_PATTERN.test(key) && val !== undefined && val !== '') {
        issues.push(`Forbidden credential field "${key}" detected at ${nextPath}.`);
      }
      issues.push(...detectSecretLeaks(val, nextPath));
    }
  }

  return issues;
}

export function redactStringSecrets(input: string): string {
  let output = input;
  for (const pattern of SECRET_VALUE_PATTERNS) {
    pattern.lastIndex = 0;
    output = output.replace(pattern, '[REDACTED_SECRET]');
  }
  // Also redact inline key=value patterns such as api_key=xyz or password: xyz
  output = output.replace(
    /\b(api_?key|secret|password|passwd|access_?token|refresh_?token|private_?key|authorization)\s*([:=])\s*([^\s,'"}]+)/gi,
    '$1$2[REDACTED_SECRET]'
  );
  return output;
}

export function redactSecrets<T>(value: T): T {
  if (typeof value === 'string') {
    return redactStringSecrets(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item)) as T;
  }

  if (value && typeof value === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        clean[key] = '[REDACTED_SECRET]';
      } else {
        clean[key] = redactSecrets(val);
      }
    }
    return clean as T;
  }

  return value;
}

const PERMISSION_OVERRIDE_PATTERNS: RegExp[] = [
  /override[_\s-]*permissions?/i,
  /grant[_\s-]*all[_\s-]*scopes?/i,
  /bypass[_\s-]*approval/i,
  /system[_\s-]*approval\s*[:=]\s*true/i,
  /ignore\s+previous\s+policy/i,
];

/**
 * Inspects untrusted text or model output for attempted permission override
 * directives. System permissions are ALWAYS authoritative and never modified
 * by model-generated text.
 */
export function detectPermissionOverrideAttempt(value: unknown): boolean {
  if (typeof value === 'string') {
    return PERMISSION_OVERRIDE_PATTERNS.some((pattern) => pattern.test(value));
  }
  if (Array.isArray(value)) {
    return value.some((item) => detectPermissionOverrideAttempt(item));
  }
  if (value && typeof value === 'object') {
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (
        /^(override_permissions|bypass_approval|grant_scopes|force_approve|system_permissions_override)$/i.test(
          key
        )
      ) {
        return true;
      }
      if (detectPermissionOverrideAttempt(val)) {
        return true;
      }
    }
  }
  return false;
}
