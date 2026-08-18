import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import { LogCorrelator, RingBuffer } from './correlator.js';
import { ParsedLog } from './types.js';

describe('RingBuffer & Correlator Engine', () => {
  it('maintains circular capacity in RingBuffer', () => {
    const buffer = new RingBuffer<number>(3);
    buffer.push(1);
    buffer.push(2);
    buffer.push(3);
    assert.deepStrictEqual(buffer.toArray(), [1, 2, 3]);

    // Push 4th item -> item 1 evicted
    buffer.push(4);
    assert.deepStrictEqual(buffer.toArray(), [2, 3, 4]);
  });

  it('correlates multi-hop transaction across 3 microservice pods', () => {
    const correlator = new LogCorrelator(100);
    const traceId = 'trx-test-hop-1';

    const logGw: ParsedLog = {
      id: '1',
      timestamp: '2026-08-18T10:00:00.000Z',
      service: 'api-gateway',
      podName: 'gw-pod',
      level: 'INFO',
      traceId,
      rrn: '123456789012',
      transactionType: 'INQUIRY',
      statusCode: null,
      message: 'Gateway received req',
      rawLog: 'Gateway received req',
      masked: true
    };

    const logGate: ParsedLog = {
      id: '2',
      timestamp: '2026-08-18T10:00:00.100Z',
      service: 'gate-service',
      podName: 'gate-pod',
      level: 'INFO',
      traceId,
      rrn: '123456789012',
      transactionType: 'INQUIRY',
      statusCode: null,
      message: 'Gate routing rule OK',
      rawLog: 'Gate routing rule OK',
      masked: true
    };

    const logSwc: ParsedLog = {
      id: '3',
      timestamp: '2026-08-18T10:00:00.250Z',
      service: 'transport-core-swc',
      podName: 'swc-pod',
      level: 'INFO',
      traceId,
      rrn: '123456789012',
      transactionType: 'INQUIRY',
      statusCode: '00',
      message: 'SWC host response 0210 RC=00',
      rawLog: 'SWC host response 0210 RC=00',
      masked: true
    };

    correlator.addLog(logGw);
    correlator.addLog(logGate);
    correlator.addLog(logSwc);

    const trace = correlator.getTrace(traceId);
    assert.ok(trace);
    assert.strictEqual(trace.traceId, traceId);
    assert.strictEqual(trace.isComplete, true);
    assert.strictEqual(trace.hasError, false);
    assert.strictEqual(trace.finalStatus, '00');
    assert.strictEqual(trace.hops.gateway?.length, 1);
    assert.strictEqual(trace.hops.gate?.length, 1);
    assert.strictEqual(trace.hops.transport?.length, 1);
  });
});
