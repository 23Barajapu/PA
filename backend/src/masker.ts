/**
 * Banking Security Data Masker
 * Masks sensitive financial & authentication data from raw logs before streaming.
 */

const MASK_PATTERNS = [
  // Card PAN (16 digits with optional spaces or dashes): 4111 2222 3333 4444 -> 4111-22**-****-4444
  {
    regex: /\b(4[0-9]{3}|5[1-5][0-9]{2}|6011|65[0-9]{2})[ -]?([0-9]{4})[ -]?([0-9]{4})[ -]?([0-9]{4})\b/g,
    replace: (match: string, p1: string, p2: string, p3: string, p4: string) => `${p1}-****-****-${p4}`
  },
  // Generic 16 digit PAN
  {
    regex: /\b([0-9]{4})[0-9]{8}([0-9]{4})\b/g,
    replace: '$1********$2'
  },
  // Bank Account Numbers (10 to 14 digits) e.g. "accountNumber": "1234567890" or "acc": "123456789012"
  {
    regex: /(["']?(?:account(?:Number|_no|_num)?|acc_no|sourceAccount|destAccount|rek(?:ening)?)["']?\s*[:=]\s*["']?)([0-9]{3,4})([0-9]{4,8})([0-9]{2,4})(["']?)/gi,
    replace: (_match: string, p1: string, p2: string, p3: string, p4: string, p5: string) => {
      const stars = '*'.repeat(p3.length);
      return `${p1}${p2}${stars}${p4}${p5}`;
    }
  },
  // Bearer Tokens: "Bearer eyJhbGciOi..." -> "Bearer eyJhb***masked***"
  {
    regex: /(Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.)([A-Za-z0-9-_=]+)/gi,
    replace: '$1[MASKED_SIGNATURE]'
  },
  // Authorization Headers / API Keys
  {
    regex: /(["']?(?:authorization|api[_-]?key|secret|token|password|pin|pinBlock|cvv|otp)["']?\s*[:=]\s*["']?)([^"',\s\}]{3,})([^"',\s\}]{2})(["']?)/gi,
    replace: (_match: string, p1: string, _p2: string, p3: string, p4: string) => `${p1}***MASKED***${p3}${p4}`
  },
  // ISO8583 Field 52 (PIN Block) in hex dumps
  {
    regex: /(F52|bit52|PIN\s*Block)\s*[:=]\s*([0-9A-Fa-f]{16})/gi,
    replace: '$1: [MASKED_PIN_BLOCK]'
  }
];

export function maskLogMessage(raw: string): string {
  if (!raw) return '';
  let result = raw;
  for (const { regex, replace } of MASK_PATTERNS) {
    if (typeof replace === 'string') {
      result = result.replace(regex, replace);
    } else {
      result = result.replace(regex, replace as any);
    }
  }
  return result;
}
