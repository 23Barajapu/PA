import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseRawLog } from './parser.js';

describe('Log Parser & Transaction Extractor', () => {
  it('parses JSON format logs from API Gateway', () => {
    const raw = JSON.stringify({
      timestamp: '2026-08-18T10:00:00.000Z',
      level: 'INFO',
      traceId: 'trx-gw-12345',
      rrn: '987654321012',
      tx_type: 'POSTING',
      statusCode: '200',
      message: 'Payment received'
    });

    const parsed = parseRawLog(raw, 'api-gateway-pod-1');
    assert.strictEqual(parsed.service, 'api-gateway');
    assert.strictEqual(parsed.traceId, 'trx-gw-12345');
    assert.strictEqual(parsed.rrn, '987654321012');
    assert.strictEqual(parsed.transactionType, 'POSTING');
    assert.strictEqual(parsed.statusCode, '200');
    assert.strictEqual(parsed.level, 'INFO');
  });

  it('parses Spring / ISO8583 text dump logs from Transport SWC', () => {
    const raw = '[2026-08-18 10:00:01] [transport-core-swc] INFO trace_id=trx-swc-999 rrn=112233445566 ProcCode=310000 MTI=0210 rc=00 latency=150ms - Host response OK';
    const parsed = parseRawLog(raw, 'transport-core-swc-pod-2');

    assert.strictEqual(parsed.service, 'transport-core-swc');
    assert.strictEqual(parsed.traceId, 'trx-swc-999');
    assert.strictEqual(parsed.rrn, '112233445566');
    assert.strictEqual(parsed.transactionType, 'INQUIRY');
    assert.strictEqual(parsed.statusCode, '00');
    assert.strictEqual(parsed.mti, '0210');
    assert.strictEqual(parsed.latencyMs, 150);
  });

  it('infers service from pod name if not explicitly stated in log', () => {
    const raw = 'Unhandled exception occurred';
    const parsed = parseRawLog(raw, 'gate-service-deployment-abc');
    assert.strictEqual(parsed.service, 'gate-service');
  });
});
