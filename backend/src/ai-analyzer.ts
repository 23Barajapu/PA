import { HopTrace, ParsedLog } from './types.js';

export interface AiAnalysisResult {
  traceId: string;
  rrn: string | null;
  transactionType: string;
  status: 'SUCCESS' | 'FAILURE' | 'WARNING';
  failedService: string | null;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  rootCause: string;
  technicalDetails: string;
  recommendedAction: string;
  engineUsed: string;
  jiraTicket: {
    summary: string;
    issueType: 'Bug' | 'Incident' | 'Task';
    priority: 'Highest' | 'High' | 'Medium' | 'Low';
    description: string;
  };
}

export async function analyzeTraceWithAi(trace: HopTrace): Promise<AiAnalysisResult> {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const ollamaModel = process.env.OLLAMA_MODEL || 'llama3';
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  // Compile structured log summary for LLM prompt
  const logSummary = compileTraceSummary(trace);

  // 1. Try Gemini API if Key is present
  if (geminiApiKey) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
      const res = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: buildPrompt(logSummary) }]
          }],
          generationConfig: {
            responseMimeType: "application/json"
          }
        }),
        signal: AbortSignal.timeout(8000)
      });

      if (res.ok) {
        const data: any = await res.json();
        const rawJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawJsonText) {
          const parsed = JSON.parse(rawJsonText);
          return formatAiResponse(trace, parsed, 'Google Gemini 1.5 Flash');
        }
      }
    } catch (err: any) {
      console.warn('[AI-Analyzer] Gemini API failed, falling back:', err?.message || err);
    }
  }

  // 2. Try Ollama (Local LLM)
  try {
    const res = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel,
        prompt: buildPrompt(logSummary),
        stream: false,
        format: 'json'
      }),
      signal: AbortSignal.timeout(6000)
    });

    if (res.ok) {
      const data: any = await res.json();
      const parsed = JSON.parse(data.response);
      return formatAiResponse(trace, parsed, `Ollama (${ollamaModel})`);
    }
  } catch (err: any) {
    // Ollama not running or timeout -> try next or fallback
  }

  // 2. Try OpenAI API if Key is present
  if (openaiApiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: buildPrompt(logSummary) }],
          response_format: { type: 'json_object' }
        }),
        signal: AbortSignal.timeout(8000)
      });
      if (res.ok) {
        const data: any = await res.json();
        const parsed = JSON.parse(data.choices[0].message.content);
        return formatAiResponse(trace, parsed, 'OpenAI GPT-4o-mini');
      }
    } catch (err) {
      // Fallback
    }
  }

  // 3. Fallback Heuristic Diagnostic Engine (100% reliable, zero external dependency)
  return runHeuristicAnalysis(trace);
}

function compileTraceSummary(trace: HopTrace): string {
  const lines: string[] = [];
  lines.push(`Trace ID: ${trace.traceId}`);
  lines.push(`RRN: ${trace.rrn || 'N/A'}`);
  lines.push(`Tx Type: ${trace.transactionType}`);
  lines.push(`Total Latency: ${trace.totalLatencyMs || 0}ms`);
  lines.push(`Final Status: ${trace.finalStatus || 'N/A'}`);
  lines.push(`Has Error: ${trace.hasError}`);

  lines.push('\nHop 1 (API Gateway Logs):');
  (trace.hops.gateway || []).forEach(l => lines.push(`- [${l.level}] ${l.message} (RC: ${l.statusCode || '-'})`));

  lines.push('\nHop 2 (Gate Service Logs):');
  (trace.hops.gate || []).forEach(l => lines.push(`- [${l.level}] ${l.message} (RC: ${l.statusCode || '-'})`));

  lines.push('\nHop 3 (Transport Core SWC Logs):');
  (trace.hops.transport || []).forEach(l => lines.push(`- [${l.level}] ${l.message} (RC: ${l.statusCode || '-'}, MTI: ${l.mti || '-'})`));

  return lines.join('\n');
}

function buildPrompt(logSummary: string): string {
  return `You are a Senior Core Banking & Microservices QA Architect. Analyze the following 3-hop Kubernetes transaction logs (API Gateway -> Gate Service -> Transport Core SWC) and output ONLY valid JSON.

Log Data:
${logSummary}

Return JSON with this exact schema:
{
  "failedService": "api-gateway" | "gate-service" | "transport-core-swc" | null,
  "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO",
  "rootCause": "Short 1-2 sentence executive summary of root cause",
  "technicalDetails": "Detailed breakdown of the error code, protocol failure, or timeout",
  "recommendedAction": "Actionable fix for engineering or operations team"
}`;
}

function formatAiResponse(trace: HopTrace, parsed: any, engine: string): AiAnalysisResult {
  const isFailed = trace.hasError || parsed.severity === 'CRITICAL' || parsed.severity === 'HIGH';
  const failedSvc = parsed.failedService || (isFailed ? 'transport-core-swc' : null);

  const jiraDescription = `h2. Defect Description
${parsed.rootCause}

h2. Technical Evidence & Diagnostics
* *Trace ID:* ${trace.traceId}
* *RRN:* ${trace.rrn || 'N/A'}
* *Transaction Type:* ${trace.transactionType}
* *Failed Service:* ${failedSvc || 'None'}
* *Total Latency:* ${trace.totalLatencyMs || 0}ms
* *AI Engine:* ${engine}

h3. Root Cause Breakdown
${parsed.technicalDetails}

h3. Recommended Remediation
${parsed.recommendedAction}

h2. Log Hop Trace
{code:json}
${JSON.stringify(trace.hops, null, 2)}
{code}`;

  return {
    traceId: trace.traceId,
    rrn: trace.rrn,
    transactionType: trace.transactionType,
    status: isFailed ? 'FAILURE' : 'SUCCESS',
    failedService: failedSvc,
    severity: parsed.severity || (isFailed ? 'HIGH' : 'INFO'),
    rootCause: parsed.rootCause || 'Transaction processed successfully.',
    technicalDetails: parsed.technicalDetails || 'All 3 hops completed without protocol errors.',
    recommendedAction: parsed.recommendedAction || 'No remediation required.',
    engineUsed: engine,
    jiraTicket: {
      summary: `[BUG][${(failedSvc || 'SWITCHING').toUpperCase()}] ${trace.transactionType} Transaction Failure - Trace ${trace.traceId}`,
      issueType: isFailed ? 'Bug' : 'Task',
      priority: parsed.severity === 'CRITICAL' ? 'Highest' : (parsed.severity === 'HIGH' ? 'High' : 'Medium'),
      description: jiraDescription
    }
  };
}

export function runHeuristicAnalysis(trace: HopTrace): AiAnalysisResult {
  const allLogs: ParsedLog[] = [
    ...(trace.hops.gateway || []),
    ...(trace.hops.gate || []),
    ...(trace.hops.transport || [])
  ];

  let failedService: string | null = null;
  let severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO' = 'INFO';
  let rootCause = 'Transaction succeeded across all microservice hops (RC=00).';
  let technicalDetails = 'API Gateway received request, Gate Service performed routing validation, and Transport Core SWC exchanged ISO8583 message with host successfully.';
  let recommendedAction = 'No action needed. System operating within normal parameters.';

  const timeoutLog = allLogs.find(l => l.statusCode === '68' || l.statusCode === '504' || l.message.toLowerCase().includes('timeout'));
  const balanceLog = allLogs.find(l => l.statusCode === '51' || l.message.toLowerCase().includes('insufficient'));
  const errorLog = allLogs.find(l => l.level === 'ERROR' || l.statusCode === '500' || l.statusCode === '91');

  if (timeoutLog) {
    failedService = timeoutLog.service;
    severity = 'CRITICAL';
    rootCause = `Core Banking Host Timeout (ISO8583 Response Code 68) at service [${failedService}].`;
    technicalDetails = `The Transport Core SWC sent MTI 0200 to Core Banking host socket, but no 0210 response was received within SLA threshold (Duration: ${trace.totalLatencyMs || 0}ms). API Gateway returned HTTP 504.`;
    recommendedAction = 'Check Core Banking Host TCP socket connection (port 9000), review core host queue depth, and verify network connectivity between Transport Pod and host.';
  } else if (balanceLog) {
    failedService = balanceLog.service;
    severity = 'MEDIUM';
    rootCause = `Transaction Declined: Insufficient Account Balance (ISO8583 Response Code 51).`;
    technicalDetails = `Core Banking host evaluated source account balance and rejected the ${trace.transactionType} request. Return Code 51 forwarded back to API Gateway.`;
    recommendedAction = 'Advise customer to check account funds or verify debit limit configuration.';
  } else if (errorLog) {
    failedService = errorLog.service;
    severity = 'HIGH';
    rootCause = `System Exception / Internal Server Error detected in [${failedService}].`;
    technicalDetails = `Error log captured: "${errorLog.message}". Status Code: ${errorLog.statusCode || '500'}.`;
    recommendedAction = `Inspect pod logs for [${failedService}] to investigate unhandled exception or database/redis connectivity drops.`;
  }

  const isFailed = severity !== 'INFO';

  const jiraDescription = `h2. Defect Description
${rootCause}

h2. Technical Evidence & Diagnostics
* *Trace ID:* ${trace.traceId}
* *RRN:* ${trace.rrn || 'N/A'}
* *Transaction Type:* ${trace.transactionType}
* *Failed Service:* ${failedService || 'None'}
* *Total Latency:* ${trace.totalLatencyMs || 0}ms
* *AI Engine:* Built-in Banking Heuristic Diagnostic Engine

h3. Root Cause Breakdown
${technicalDetails}

h3. Recommended Remediation
${recommendedAction}

h2. Microservices Log Trace
{code:json}
${JSON.stringify(trace.hops, null, 2)}
{code}`;

  return {
    traceId: trace.traceId,
    rrn: trace.rrn,
    transactionType: trace.transactionType,
    status: isFailed ? 'FAILURE' : 'SUCCESS',
    failedService,
    severity,
    rootCause,
    technicalDetails,
    recommendedAction,
    engineUsed: 'Built-in Banking Heuristic Engine',
    jiraTicket: {
      summary: `[BUG][${(failedService || 'SWITCHING').toUpperCase()}] ${trace.transactionType} Failure - Trace ${trace.traceId}`,
      issueType: isFailed ? 'Bug' : 'Task',
      priority: severity === 'CRITICAL' ? 'Highest' : (severity === 'HIGH' ? 'High' : 'Medium'),
      description: jiraDescription
    }
  };
}
