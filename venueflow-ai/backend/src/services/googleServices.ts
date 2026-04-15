/**
 * VenueFlow AI — Google Services Integration
 * @description Centralizes ALL Google Cloud service calls in one place.
 *
 * Active Google Services:
 *   1. Vertex AI (Gemini 2.0 Flash)  — AI predictions, zone intel, PA announcements
 *   2. Google OAuth 2.0               — User authentication (via passport-google-oauth20)
 *   3. Google Cloud Logging           — Operational telemetry & prediction logging
 *   4. Google Cloud Run               — Serverless container hosting (asia-south1)
 *   5. Google Cloud Storage           — Operations report archival & PA announcement logs
 *   6. Firebase Admin + Firestore     — Real-time AI prediction store, fan activity, announcements
 */

import { VertexAI, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai';
import { Logging } from '@google-cloud/logging';
import { Storage } from '@google-cloud/storage';
import * as admin from 'firebase-admin';

// ─── Configuration ────────────────────────────────────────────────────────────
export const GCS_BUCKET = `${process.env.GOOGLE_CLOUD_PROJECT_ID || 'venue-flow-ai-493017'}-venueflow-reports`;
export const PROJECT_ID =
  process.env.GOOGLE_CLOUD_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  'venue-flow-ai-493017';

export const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'asia-south1';
export const MODEL_ID = 'gemini-2.0-flash-001';

const shouldUseMockAI = process.env.NODE_ENV === 'test' || !PROJECT_ID;

// ─── Firebase Admin + Firestore Setup ───────────────────────────────────────────
let _firebaseApp: admin.app.App | null = null;

function getFirestore(): admin.firestore.Firestore {
  if (!_firebaseApp) {
    _firebaseApp = admin.apps.length
      ? admin.apps[0]!
      : admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId: PROJECT_ID,
        });
  }
  return admin.firestore(_firebaseApp!);
}

/**
 * Stores AI predictions in Firestore (venueflow-predictions collection).
 * Called after every generatePredictions() Vertex AI call.
 */
export async function storePredictionsInFirestore(
  predictions: FlowAgentPrediction[],
  phase: string,
  totalFans: number
): Promise<void> {
  try {
    const db = getFirestore();
    const batch = db.batch();
    const sessionRef = db
      .collection('venueflow-predictions')
      .doc(new Date().toISOString().split('T')[0])  // Daily doc
      .collection('sessions')
      .doc(Date.now().toString());

    batch.set(sessionRef, {
      predictions,
      phase,
      totalFans,
      model: MODEL_ID,
      location: LOCATION,
      projectId: PROJECT_ID,
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      service: 'venueflow-ai',
    });
    await batch.commit();
    console.log('[Firebase] Predictions stored in Firestore');
  } catch (err: any) {
    console.error('[Firebase] Firestore write failed (non-critical):', err.message);
  }
}

/**
 * Stores a PA announcement in Firestore (venueflow-announcements collection).
 * Called after every generatePAnnouncement() call.
 */
export async function storeAnnouncementInFirestore(
  zoneName: string,
  announcement: string
): Promise<void> {
  try {
    const db = getFirestore();
    await db.collection('venueflow-announcements').add({
      zoneName,
      announcement,
      model: MODEL_ID,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      source: 'vertex-ai-gemini',
    });
    console.log('[Firebase] Announcement stored in Firestore:', zoneName);
  } catch (err: any) {
    console.error('[Firebase] Announcement write failed (non-critical):', err.message);
  }
}

/**
 * Logs a FlowBot fan interaction to Firestore.
 * Stores anonymised chat sessions for analytics.
 */
export async function logFlowBotInteraction(
  fanId: string | undefined,
  messagePreview: string,
  responseLength: number
): Promise<void> {
  try {
    const db = getFirestore();
    await db.collection('venueflow-chatbot-sessions').add({
      fanId: fanId || 'anonymous',
      messagePreview: messagePreview.substring(0, 50),
      responseLength,
      model: MODEL_ID,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      event: 'IPL 2025 MI vs CSK',
      venue: 'DY Patil Stadium',
    });
  } catch {
    // Silent failure — non-critical analytics
  }
}

// ─── Vertex AI Setup ─────────────────────────────────────────────────────────
let _vertexAI: VertexAI | null = null;

function getVertexAI(): VertexAI {
  if (!_vertexAI) {
    _vertexAI = new VertexAI({ project: PROJECT_ID, location: LOCATION });
  }
  return _vertexAI;
}

function getGenerativeModel() {
  return getVertexAI().getGenerativeModel({
    model: MODEL_ID,
    generationConfig: {
      maxOutputTokens: 512,
      temperature: 0.4,
      topP: 0.8,
    },
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
    ],
  });
}

// ─── Cloud Logging Setup ─────────────────────────────────────────────────────
let _logging: Logging | null = null;

function getLogging(): Logging {
  if (!_logging) {
    _logging = new Logging({ projectId: PROJECT_ID });
  }
  return _logging;
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PredictZone {
  id: string;
  name: string;
  type?: string;
  occ: number;
  cap: number;
  history?: number[];
}

export interface FlowAgentPrediction {
  prediction: string;
  action: string;
  actionType: 'deploy_staff' | 'open_gate' | 'alert_vendors' | 'broadcast_pa' | 'monitor';
  confidence: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  targetZone: string;
}

export interface ZoneIntelligence {
  assessment: string;
  trend: 'rising' | 'falling' | 'stable' | 'volatile';
  peakExpected: string;
  recommendation: string;
  redirectTo: string;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function extractText(response: any): string {
  return response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

function parseJSON<T>(raw: string): T {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned) as T;
}

export function calculateTrend(history: number[]): string {
  if (history.length < 3) return 'stable';
  const recent = history.slice(-3);
  const older = history.slice(0, -3);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg =
    older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : recentAvg;
  const range = Math.max(...recent) - Math.min(...recent);
  if (range > 15) return 'volatile';
  if (recentAvg > olderAvg + 5) return 'rising';
  if (recentAvg < olderAvg - 5) return 'falling';
  return 'stable';
}

// ─── Fallback Predictions (no Vertex AI) ─────────────────────────────────────
export function getFallbackPredictions(zones: PredictZone[]): FlowAgentPrediction[] {
  const critical = zones.filter(z => z.occ / z.cap > 0.85);
  const busy = zones.filter(z => z.occ / z.cap > 0.70);
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

// ─── 1. generatePredictions ───────────────────────────────────────────────────
/**
 * Calls Vertex AI Gemini 2.0 Flash with live zone data.
 * Returns 3 structured, actionable staff predictions.
 */
export async function generatePredictions(
  zones: PredictZone[],
  phase: string,
  totalFans: number,
  capacity: number
): Promise<FlowAgentPrediction[]> {
  if (shouldUseMockAI) return getFallbackPredictions(zones);

  const overallLoad = Math.round((totalFans / capacity) * 100);

  const zoneContext = zones
    .map(z => {
      const pct = Math.round((z.occ / z.cap) * 100);
      const wait = Math.round((pct / 100) * 15);
      const status = pct > 85 ? 'CRITICAL' : pct > 70 ? 'HIGH' : pct > 40 ? 'MED' : 'LOW';
      return `  • ${z.name} [${z.type || 'zone'}]: ${pct}% full (${z.occ}/${z.cap}) — ${status} — ~${wait}min wait`;
    })
    .join('\n');

  const prompt = `You are FlowAgent, an AI operations assistant for VenueFlow AI — managing IPL 2025 MI vs CSK at DY Patil Stadium, Mumbai (capacity: ${capacity}).

LIVE VENUE STATE:
- Phase: ${phase}
- Occupancy: ${totalFans.toLocaleString()}/${capacity.toLocaleString()} (${overallLoad}% overall load)
- Zone breakdown:
${zoneContext}

Generate exactly 3 actionable predictions for venue operations staff based on this REAL-TIME data.

Return ONLY a raw JSON array, no markdown, no explanation:
[
  {
    "prediction": "specific prediction max 12 words",
    "action": "action verb + object max 4 words",
    "actionType": "deploy_staff|open_gate|alert_vendors|broadcast_pa|monitor",
    "confidence": <integer 72-97>,
    "urgency": "low|medium|high|critical",
    "targetZone": "exact zone name from data above"
  }
]

Rules:
- Base ALL predictions on the actual zone percentages given
- If any zone is CRITICAL (>85%), at least one prediction MUST address it directly
- Vary confidence and urgency realistically`;

  try {
    const model = getGenerativeModel();
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    const parsed = parseJSON<FlowAgentPrediction[]>(extractText(result.response));
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return getFallbackPredictions(zones);
  } catch (err: any) {
    console.error('[GoogleServices] generatePredictions error:', err.message);
    return getFallbackPredictions(zones);
  }
}

// ─── 2. generateZoneIntelligence ─────────────────────────────────────────────
/**
 * Deep-dives a specific zone: trend analysis, peak prediction, redirect recommendation.
 * Called when operations staff click any zone on the live heatmap.
 */
export async function generateZoneIntelligence(
  zone: PredictZone,
  allZones: PredictZone[],
  phase: string
): Promise<ZoneIntelligence> {
  const fallback: ZoneIntelligence = {
    assessment: `${zone.name} is operating at ${Math.round((zone.occ / zone.cap) * 100)}% capacity with moderate throughput.`,
    trend: 'stable',
    peakExpected: '15-20 minutes',
    recommendation: 'Monitor zone and maintain current staffing levels.',
    redirectTo: allZones.find(z => z.id !== zone.id)?.name || 'Adjacent Zone',
    riskLevel: 'moderate',
  };

  if (shouldUseMockAI) return fallback;

  const pct = Math.round((zone.occ / zone.cap) * 100);
  const wait = Math.round((pct / 100) * 15);
  const history = zone.history || [];
  const trend = calculateTrend(history);
  const altZones = allZones
    .filter(z => z.id !== zone.id)
    .sort((a, b) => a.occ / a.cap - b.occ / b.cap);

  const prompt = `Analyze this venue zone for MetroArena IPL operations staff.

Zone: ${zone.name} (type: ${zone.type || 'general'})
Occupancy: ${pct}% — ${zone.occ}/${zone.cap} people
Estimated wait: ~${wait} minutes
Recent trend: ${trend}
History (last readings): ${history.join(', ')}% ${history.length === 0 ? '(no history)' : ''}
Event phase: ${phase}
Best alternative zone: ${altZones[0]?.name || 'None'} at ${Math.round(((altZones[0]?.occ || 0) / (altZones[0]?.cap || 1)) * 100)}%

Return ONLY raw JSON, no markdown:
{
  "assessment": "2 data-driven sentences about this zone",
  "trend": "rising|falling|stable|volatile",
  "peakExpected": "e.g. 8-12 minutes or 20+ minutes",
  "recommendation": "1 specific actionable staff instruction",
  "redirectTo": "best alternative zone name",
  "riskLevel": "low|moderate|high|critical"
}`;

  try {
    const model = getGenerativeModel();
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    return parseJSON<ZoneIntelligence>(extractText(result.response));
  } catch (err: any) {
    console.error('[GoogleServices] generateZoneIntelligence error:', err.message);
    return fallback;
  }
}

// ─── 3. generatePAnnouncement ─────────────────────────────────────────────────
/**
 * Generates a friendly, natural-language PA announcement for a congested zone.
 * Called from the PA announcement generator and zone management panel.
 */
export async function generatePAnnouncement(
  zone: PredictZone,
  altZone: PredictZone
): Promise<string> {
  const pct = Math.round((zone.occ / zone.cap) * 100);
  const wait = Math.round((pct / 100) * 15);
  const altPct = Math.round((altZone.occ / altZone.cap) * 100);
  const altWait = Math.round((altPct / 100) * 15);

  const fallback = `Attention fans! ${zone.name} is currently busy with a ~${wait} minute wait. For a faster experience, please head to ${altZone.name} where wait times are approximately ${altWait} minutes. Thank you and enjoy the match!`;

  if (shouldUseMockAI) return fallback;

  const prompt = `Write a friendly public address announcement for MetroArena IPL stadium operations staff.

Situation: ${zone.name} is at ${pct}% capacity with ~${wait} minute wait.
Redirect fans to: ${altZone.name} which is only ${altPct}% full (~${altWait}min wait).

Rules:
- Friendly and upbeat tone that does not cause panic
- Mention both zones by their exact names
- Include actual wait times
- Maximum 2 sentences
- End with "Thank you and enjoy the match!"
- Return ONLY the announcement text, nothing else`;

  try {
    const model = getGenerativeModel();
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    return extractText(result.response).trim() || fallback;
  } catch (err: any) {
    console.error('[GoogleServices] generatePAnnouncement error:', err.message);
    return fallback;
  }
}

// ─── 4. logOperationalEvent ───────────────────────────────────────────────────
/**
 * Logs operational events to Google Cloud Logging (venueflow-operations log).
 * Silently degrades if Cloud Logging is unavailable.
 */
export async function logOperationalEvent(
  eventType: string,
  data: Record<string, any>
): Promise<void> {
  try {
    const log = getLogging().log('venueflow-operations');
    const metadata = {
      resource: {
        type: 'cloud_run_revision',
        labels: { service_name: 'venue-flow-ai', location: LOCATION },
      },
      severity: data.severity || 'INFO',
    };
    const entry = log.entry(metadata, {
      eventType,
      service: 'venueflow-ai',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      ...data,
    });
    await log.write(entry);
  } catch {
    // Cloud Logging is optional — silent failure
  }
}

// ─── 5. logPredictionEvent ────────────────────────────────────────────────────
/**
 * Logs AI prediction metadata to Google Cloud Logging (venueflow-predictions log).
 * Tracks model usage, latency, and criticality metrics.
 */
export async function logPredictionEvent(
  predictions: FlowAgentPrediction[],
  latencyMs: number
): Promise<void> {
  try {
    const log = getLogging().log('venueflow-predictions');
    const metadata = {
      resource: {
        type: 'cloud_run_revision',
        labels: { service_name: 'venue-flow-ai' },
      },
    };
    const entry = log.entry(metadata, {
      model: MODEL_ID,
      location: LOCATION,
      predictionCount: predictions.length,
      criticalPredictions: predictions.filter(p => p.urgency === 'critical').length,
      latencyMs,
      timestamp: new Date().toISOString(),
    });
    await log.write(entry);
  } catch {
    // Cloud Logging is optional — silent failure
  }
}
// ─── 6. Google Cloud Storage — Report Archival ───────────────────────────────
/**
 * Uploads an operations report to Google Cloud Storage.
 * Bucket: venue-flow-ai-493017-venueflow-reports
 * Used by: /api/admin/export-report endpoint
 */
let _storage: Storage | null = null;

function getStorage(): Storage {
  if (!_storage) {
    _storage = new Storage({ projectId: PROJECT_ID });
  }
  return _storage;
}

export async function uploadReportToGCS(
  reportContent: string,
  filename: string
): Promise<string> {
  try {
    const storage = getStorage();
    const bucket = storage.bucket(GCS_BUCKET);

    // Ensure bucket exists (create if not)
    const [exists] = await bucket.exists();
    if (!exists) {
      await bucket.create({ location: LOCATION });
    }

    const file = bucket.file(`reports/${filename}`);
    await file.save(reportContent, {
      contentType: 'text/plain',
      metadata: {
        cacheControl: 'no-cache',
        source: 'venueflow-ai',
        model: MODEL_ID,
        generatedAt: new Date().toISOString(),
      },
    });

    const gcsUri = `gs://${GCS_BUCKET}/reports/${filename}`;
    console.log(`[GoogleStorage] Report uploaded: ${gcsUri}`);
    return gcsUri;
  } catch (err: any) {
    console.error('[GoogleStorage] Upload failed (non-critical):', err.message);
    return '';  // Non-critical — report is still served locally
  }
}

export async function uploadPAAnnouncementLog(
  zoneName: string,
  announcement: string,
  timestamp: string
): Promise<void> {
  try {
    const storage = getStorage();
    const bucket = storage.bucket(GCS_BUCKET);
    const [exists] = await bucket.exists();
    if (!exists) await bucket.create({ location: LOCATION });

    const logEntry = JSON.stringify({ zoneName, announcement, timestamp, model: MODEL_ID });
    const file = bucket.file(`pa-logs/${timestamp.replace(/:/g, '-')}.json`);
    await file.save(logEntry, { contentType: 'application/json' });
  } catch {
    // Silent failure — PA logs are supplementary
  }
}
