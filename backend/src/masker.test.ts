import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import { maskLogMessage } from './masker.js';

describe('Security Masker Engine', () => {
  it('masks 16-digit credit/debit Card PAN correctly', () => {
    const raw = 'Customer used card 4111222233334444 for payment';
    const masked = maskLogMessage(raw);
    assert.strictEqual(masked.includes('4111222233334444'), false);
    assert.ok(masked.includes('4111-****-****-4444') || masked.includes('4111********4444'));
  });

  it('masks bank account numbers in JSON and key-value formats', () => {
    const rawJson = '{"accountNumber": "50212345678", "amount": 50000}';
    const masked = maskLogMessage(rawJson);
    assert.strictEqual(masked.includes('50212345678'), false);
    assert.ok(masked.includes('5021') && masked.includes('78'));
  });

  it('masks Bearer JWT tokens', () => {
    const raw = 'Header Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0In0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const masked = maskLogMessage(raw);
    assert.strictEqual(masked.includes('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'), false);
    assert.ok(masked.includes('[MASKED_SIGNATURE]'));
  });

  it('masks ISO8583 PIN Block bit 52 hex dumps', () => {
    const raw = 'ISO message payload F52: 1234567890ABCDEF bit52=[AABBCCDDEEFF0011]';
    const masked = maskLogMessage(raw);
    assert.strictEqual(masked.includes('1234567890ABCDEF'), false);
    assert.ok(masked.includes('[MASKED_PIN_BLOCK]'));
  });
});
