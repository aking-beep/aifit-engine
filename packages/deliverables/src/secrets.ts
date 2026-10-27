/**
 * Credential patterns, mirrored from aifit.bundle (Python) so Teams downloads
 * get the same protection as Consumer bundles. A download containing a match
 * is refused rather than redacted: Teams inputs are structured, so a match
 * means something unexpected reached the document.
 */
export const SECRET_PATTERNS: [string, RegExp][] = [
  ['private_key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['anthropic_key', /\bsk-ant-[A-Za-z0-9_-]{16,}/],
  ['openai_key', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}/],
  ['stripe_key', /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}/],
  ['stripe_webhook_secret', /\bwhsec_[A-Za-z0-9]{16,}/],
  ['aws_access_key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['github_token', /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}/],
  ['slack_token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['google_api_key', /\bAIza[0-9A-Za-z_-]{35}/],
  ['jwt', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/],
  ['assigned_secret', /\b(?:api[_-]?key|secret|password|passwd|token|bearer)\b\s*[:=]\s*['"]?[A-Za-z0-9_\-./+]{12,}/i],
];

export function findSecrets(text: string): string[] {
  return SECRET_PATTERNS.filter(([, re]) => re.test(text)).map(([name]) => name);
}
