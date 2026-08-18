import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import { runHeuristicAnalysis } from './ai-analyzer.js';
import { HopTrace } from './types.js';

describe('AI Log Analyzer & Defect Assistant', () => {
  it('diagnoses ISO8583 Response Code 68 timeout as CRITICAL defect', () => {
    const mockTimeoutTrace: HopTrace = {
      traceId: 'trx-timeout-123',
      rrn: '123456789012',
      transactionType: 'POSTING',
      startTime: '2026-08-18T10:00:00.000Z',
      endTime: '2026-08-18T10:00:05.000Z',
      totalLatencyMs: 5000,
      isComplete: true,
      hasError: true,
      hops: {
        gateway: [{
          id: '1',
          timestamp: '2026-08-18T10:00:00.000Z',
          service: 'api-gateway',
          podName: 'gw-pod',
          level: 'INFO',
          traceId: 'trx-timeout-123',
          rrn: '123456789012',
          transactionType: 'POSTING',
          statusCode: '200',
          message: 'Received POST request',
          rawLog: 'Received POST request',
          masked: true
        }],
        gate: [{
          id: '2',
          timestamp: '2026-08-18T10:00:00.100Z',
          service: 'gate-service',
          podName: 'gate-pod',
          level: 'INFO',
          traceId: 'trx-timeout-123',
          rrn: '123456789012',
          transactionType: 'POSTING',
          statusCode: null,
          message: 'Routing to Transport Core',
          rawLog: 'Routing to Transport Core',
          masked: true
        }],
        transport: [{
          id: '3',
          timestamp: '2026-08-18T10:00:05.000Z',
          service: 'transport-core-swc',
          podName: 'swc-pod',
          level: 'ERROR',
          traceId: 'trx-timeout-123',
          rrn: '123456789012',
          transactionType: 'POSTING',
          statusCode: '68',
          message: 'Socket timeout waiting for 0210 host response',
          rawLog: 'Socket timeout waiting for 0210 host response',
          masked: true
        }]
      }
    };

    const result = runHeuristicAnalysis(mockTimeoutTrace);
    assert.strictEqual(result.status, 'FAILURE');
    assert.strictEqual(result.severity, 'CRITICAL');
    assert.strictEqual(result.failedService, 'transport-core-swc');
    assert.ok(result.rootCause.includes('Timeout') || result.rootCause.includes('68'));
    assert.ok(result.jiraTicket.summary.includes('[BUG]'));
    assert.ok(result.jiraTicket.description.includes('h2. Defect Description'));
  });

  it('identifies successful transaction with zero defects', () => {
    const mockSuccessTrace: HopTrace = {
      traceId: 'trx-success-777',
      rrn: '999888777666',
      transactionType: 'INQUIRY',
      startTime: '2026-08-18T10:00:00.000Z',
      endTime: '2026-08-18T10:00:00.250Z',
      totalLatencyMs: 250,
      isComplete: true,
      hasError: false,
      hops: {
        gateway: [{
          id: '1',
          timestamp: '2026-08-18T10:00:00.000Z',
          service: 'api-gateway',
          podName: 'gw-pod',
          level: 'INFO',
          traceId: 'trx-success-777',
          rrn: '999888777666',
          transactionType: 'INQUIRY',
          statusCode: '200',
          message: 'Request OK',
          rawLog: 'Request OK',
          masked: true
        }],
        gate: [],
        transport: [{
          id: '2',
          timestamp: '2026-08-18T10:00:00.200Z',
          service: 'transport-core-swc',
          podName: 'swc-pod',
          level: 'INFO',
          traceId: 'trx-success-777',
          rrn: '999888777666',
          transactionType: 'INQUIRY',
          statusCode: '00',
          message: 'Host RC=00',
          rawLog: 'Host RC=00',
          masked: true
        }]
      }
    };

    const result = runHeuristicAnalysis(mockSuccessTrace);
    assert.strictEqual(result.status, 'SUCCESS');
    assert.strictEqual(result.severity, 'INFO');
    assert.strictEqual(result.failedService, null);
  });
});
