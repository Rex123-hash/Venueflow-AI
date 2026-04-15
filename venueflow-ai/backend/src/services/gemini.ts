import { VertexAI } from '@google-cloud/vertexai';
import { Response } from 'express';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || '';
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'asia-south1';
const MODEL_ID = 'gemini-2.0-flash-001';
const shouldUseMockAi = process.env.NODE_ENV === 'test' || !PROJECT_ID;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FlowAgentPrediction {
  prediction: string;
  action: string;
  actionType: 'deploy_staff' | 'open_gate' | 'alert_vendors' | 'broadcast_pa' | 'monitor';
  confidence: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  targetZone: string;
}

export interface PredictZoneInput {
  id: string;
  name: string;
  occ: number;
  cap: number;
}

let vertexAi: VertexAI | null = null;

function getGenAI(): VertexAI {
  if (!vertexAi) {
    if (!PROJECT_ID) {
      throw new Error('GOOGLE_CLOUD_PROJECT_ID not configured for Vertex AI');
    }
    vertexAi = new VertexAI({ project: PROJECT_ID, location: LOCATION });
  }
  return vertexAi;
}

function getResponseText(response: any): string {
  const parts = response?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';

  return parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('');
}

// ─── FlowBot: Fan Chatbot (Streaming SSE) ───────────────────────────────────

interface FlowBotContext {
  eventName: string;
  venueName: string;
  fanName: string;
  seat: string;
  stand: string;
  gate: string;
  gateWaitMin: number;
  foodStallName: string;
  foodWaitMin: number;
  zoneDensity: string;
  alertList: string;
  emergencyActive: boolean;
  emergencyExits?: string[];
}

export function buildFlowBotSystemPrompt(ctx: FlowBotContext): string {
  const exitText = ctx.emergencyExits ? ctx.emergencyExits.join(' and ') : 'nearest exit';
  return `You are FlowBot, the AI assistant for VenueFlow AI at ${ctx.eventName} in ${ctx.venueName}.
Fan details: Name=${ctx.fanName}, Seat=${ctx.seat}, Stand=${ctx.stand}, Gate=${ctx.gate}.
Live data right now:
- Their gate wait: ${ctx.gateWaitMin} minutes
- Nearest food stall: ${ctx.foodStallName}, wait ${ctx.foodWaitMin} minutes
- Their zone density: ${ctx.zoneDensity}
- Active alerts: ${ctx.alertList || 'None'}
- Emergency active: ${ctx.emergencyActive ? 'YES' : 'NO'}
${ctx.emergencyActive ? `CRITICAL: Emergency is active. ALWAYS tell the fan to follow neon green arrows on their map to ${exitText}. This is your top priority.` : ''}
Keep responses under 3 sentences. Be friendly, direct, and helpful in a casual Indian tone.
Recommend Gate B if Gate C wait > 10 min. Always suggest food courts during non-peak times.
Use ₹ for prices. Reference IST time. Speak as if you know the venue well.`;
}

export async function streamFlowBot(
  userMessage: string,
  systemPrompt: string,
  res: Response
): Promise<void> {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Mock response for tests or when Vertex AI is not configured
  if (shouldUseMockAi) {
    const mockResponse = getMockFlowBotResponse(userMessage);
    for (const char of mockResponse) {
      res.write(`data: ${JSON.stringify({ token: char })}\n\n`);
      await sleep(15);
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
    return;
  }

  try {
    const ai = getGenAI();
    // Vertex AI preview or standard model access
    const model = ai.getGenerativeModel({ model: MODEL_ID });

    const result = await model.generateContentStream(
      systemPrompt + '\n\nFan says: ' + userMessage
    );

    for await (const chunk of result.stream) {
      const text = getResponseText(chunk);
      if (text) {
        res.write(`data: ${JSON.stringify({ token: text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err: any) {
    console.error('[FlowBot] Streaming error:', err.message);
    const fallback = "Hi! Gate queues are moderate at about 8 minutes. Head to your stand via Gate C for the fastest entry — enjoy the match! 🏏";
    for (const char of fallback) {
      res.write(`data: ${JSON.stringify({ token: char })}\n\n`);
      await sleep(20);
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  }
}

// ─── FlowAgent: Manager Predictions (JSON) ──────────────────────────────────

export interface FlowAgentRecommendation {
  zone: string;
  action: string;
  urgency: 'low' | 'medium' | 'critical';
  estimated_impact: string;
  suggested_announcement: string;
}

export interface FlowAgentResponse {
  recommendations: FlowAgentRecommendation[];
  predicted_hotspots: Array<{
    zone: string;
    time_until_critical_minutes: number;
    confidence_percent: number;
  }>;
  ai_summary: string;
}

export async function runFlowAgent(simulationStateJson: string): Promise<FlowAgentResponse> {
  const systemPrompt = `You are FlowAgent, an AI operations analyst for VenueFlow AI crowd management platform at Indian sporting venues.
Analyze this venue state and respond ONLY with a valid JSON object (no markdown, no code blocks, no explanation):
{
  "recommendations": [{"zone": "string", "action": "string", "urgency": "low|medium|critical", "estimated_impact": "string", "suggested_announcement": "string"}],
  "predicted_hotspots": [{"zone": "string", "time_until_critical_minutes": number, "confidence_percent": number}],
  "ai_summary": "string"
}
Focus on safety. Be specific about crowd management actions. Use Indian context (IST, INR, Indian venue names).`;

  if (shouldUseMockAi) {
    return getMockFlowAgentResponse();
  }

  try {
    const ai = getGenAI();
    const model = ai.getGenerativeModel({ model: MODEL_ID });

    const prompt = `${systemPrompt}\n\nVenue State:\n${simulationStateJson}`;
    const result = await model.generateContent(prompt);
    const text = getResponseText(result.response).trim();

    // Strip markdown if present
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    try {
      return JSON.parse(cleaned) as FlowAgentResponse;
    } catch {
      // Retry with stricter instruction
      const retryPrompt = `${systemPrompt}\n\nCRITICAL: Return ONLY raw JSON. No text before or after. No markdown.\n\nVenue State:\n${simulationStateJson}`;
      const retryResult = await model.generateContent(retryPrompt);
      const retryText = getResponseText(retryResult.response).trim()
        .replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(retryText) as FlowAgentResponse;
    }
  } catch (err: any) {
    console.error('[FlowAgent] Error:', err.message);
    return getMockFlowAgentResponse();
  }
}

// ─── FlowAgent Predict: Structured Zone Predictions ─────────────────────────

export async function runFlowAgentPredict(
  zones: PredictZoneInput[],
  phase: string,
  totalFans: number,
  capacity: number
): Promise<FlowAgentPrediction[]> {
  if (shouldUseMockAi) {
    return getFallbackPredictions(zones);
  }

  const overallLoad = Math.round((totalFans / capacity) * 100);

  const zoneLines = zones.map(z => {
    const pct = Math.round((z.occ / z.cap) * 100);
    const wait = Math.round(pct / 100 * 15);
    const status = pct > 85 ? 'CRITICAL' : pct > 70 ? 'HIGH' : pct > 40 ? 'MED' : 'LOW';
    return `  • ${z.name}: ${pct}% full (${z.occ}/${z.cap}) — ${status} — ~${wait} min wait`;
  }).join('\n');

  const prompt = `You are FlowAgent, an AI operations assistant for VenueFlow AI — managing IPL 2025 MI vs CSK at DY Patil Stadium, Mumbai (42,000 capacity).

Current venue state:
- Event phase: ${phase}
- Total fans inside: ${totalFans.toLocaleString()} / ${capacity.toLocaleString()} (${overallLoad}% load)
- Zone data:
${zoneLines}

Generate exactly 3 actionable predictions for venue operations staff based on this REAL-TIME data.

Respond ONLY with a valid JSON array. No explanation, no markdown, no code blocks:
[
  {
    "prediction": "short prediction sentence (max 12 words)",
    "action": "specific action label (max 4 words, starts with verb)",
    "actionType": "one of: deploy_staff | open_gate | alert_vendors | broadcast_pa | monitor",
    "confidence": number between 72 and 97,
    "urgency": "one of: low | medium | high | critical",
    "targetZone": "zone name this prediction is about"
  }
]

Rules:
- Base ALL predictions on the actual zone percentages above
- If a zone is CRITICAL (>85%), at least one prediction MUST address it directly
- confidence must be realistic (not all 95%+)
- Vary urgency based on actual severity`;

  try {
    const ai = getGenAI();
    const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash-001' });
    const result = await model.generateContent(prompt);
    const text = getResponseText(result.response).trim();
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned) as FlowAgentPrediction[];
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return getFallbackPredictions(zones);
  } catch (err: any) {
    console.error('[FlowAgentPredict] Error:', err.message);
    return getFallbackPredictions(zones);
  }
}

export function getFallbackPredictions(zones: PredictZoneInput[]): FlowAgentPrediction[] {
  const critical = zones.filter(z => (z.occ / z.cap) > 0.85);
  const busy = zones.filter(z => (z.occ / z.cap) > 0.70);
  return [
    {
      prediction: critical.length > 0
        ? `${critical[0].name} at critical capacity — immediate action needed`
        : 'Venue load stable — maintain current staffing',
      action: critical.length > 0 ? 'Deploy Staff' : 'Monitor Zones',
      actionType: critical.length > 0 ? 'deploy_staff' : 'monitor',
      confidence: 78,
      urgency: critical.length > 0 ? 'critical' : 'low',
      targetZone: critical.length > 0 ? critical[0].name : 'All Zones',
    },
    {
      prediction: busy.length > 1
        ? `${busy[0].name} and ${busy[1].name} approaching high load`
        : 'Gate wait times within acceptable range',
      action: 'Open Gate D',
      actionType: 'open_gate',
      confidence: 82,
      urgency: 'medium',
      targetZone: busy.length > 0 ? busy[0].name : 'Gate D',
    },
    {
      prediction: 'Food court demand spike expected in next 10 minutes',
      action: 'Alert Vendors',
      actionType: 'alert_vendors',
      confidence: 74,
      urgency: 'medium',
      targetZone: 'Food Court Central',
    },
  ];
}

// ─── Emergency Announcement: Gemini one-shot ────────────────────────────────

export async function generateEmergencyAnnouncement(
  zoneName: string,
  exit1: string,
  exit2: string
): Promise<string> {
  if (shouldUseMockAi) {
    return `Attention all fans in the ${zoneName}: Please calmly make your way to the ${exit1} or ${exit2}. Follow the green arrows and venue staff guidance. Thank you for your cooperation.`;
  }

  try {
    const ai = getGenAI();
    const model = ai.getGenerativeModel({ model: MODEL_ID });

    const prompt = `Write a calm, clear 2-sentence PA announcement for a venue evacuation of ${zoneName}. Do not cause panic. Direct fans to ${exit1} and ${exit2}. Keep it professional and reassuring.`;
    const result = await model.generateContent(prompt);
    return getResponseText(result.response).trim();
  } catch (err: any) {
    console.error('[Emergency AI] Error:', err.message);
    return `Attention fans in ${zoneName}: Please proceed calmly to ${exit1} or ${exit2} as directed by staff. Follow the green exit arrows displayed on your VenueFlow app.`;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getMockFlowBotResponse(message: string): string {
  const lowerMsg = message.toLowerCase();
  if (lowerMsg.includes('gate') || lowerMsg.includes('wait')) {
    return "Your gate wait is currently around 8 minutes — not bad! Gate B has shorter queues if you want a quicker entry. 🚪";
  }
  if (lowerMsg.includes('food') || lowerMsg.includes('eat')) {
    return "Food Court Central has vada pav and dosas! Wait is about 5 mins right now — perfect time to grab a snack since the match just started. 🍽️";
  }
  if (lowerMsg.includes('toilet') || lowerMsg.includes('washroom') || lowerMsg.includes('restroom')) {
    return "Nearest restrooms are 50 meters behind Section D of your stand. They're accessible from both aisles. 🚻";
  }
  if (lowerMsg.includes('seat')) {
    return "Your seat is in the North Stand — great view of the pitch! Look for the section letters above each block. Your section is marked in green on the map. 🏟️";
  }
  return "I'm here to help you navigate the stadium! Ask me about gate queues, food, restrooms, or your seat location. 🏏 Enjoy the match!";
}

function getMockFlowAgentResponse(): FlowAgentResponse {
  return {
    recommendations: [
      {
        zone: 'Gate C',
        action: 'Deploy 2 additional scanning staff to Gate C to reduce queue wait from 14 to under 8 minutes',
        urgency: 'medium',
        estimated_impact: 'Reduce queue wait by 6 minutes, improve fan throughput by 40%',
        suggested_announcement: 'Gate C is currently busy — fans can also enter through Gate B for faster entry.',
      },
      {
        zone: 'Food Court Central',
        action: 'Open additional counters at Food Court Central — current utilisation is 87%',
        urgency: 'low',
        estimated_impact: 'Prevent reaching critical capacity during halftime surge',
        suggested_announcement: 'Food Court East has shorter queues right now — great options available!',
      },
    ],
    predicted_hotspots: [
      { zone: 'Food Court Central', time_until_critical_minutes: 12, confidence_percent: 78 },
      { zone: 'Gate C', time_until_critical_minutes: 20, confidence_percent: 65 },
    ],
    ai_summary: 'Crowd levels are manageable but halftime in T-12 minutes will stress food courts significantly. Recommend proactive redeployment now to avoid reactive emergency measures.',
  };
}
