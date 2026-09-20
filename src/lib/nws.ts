// Talks to the National Weather Service. Two jobs: work out which zone covers a pair of
// coordinates (onboarding), and fetch the watches and warnings running in a zone (Alerts).

// NWS requires a User-Agent naming the app and a way to reach whoever runs it.
const USER_AGENT = "(Outerwinds, github.com/imAryanL/Outerwinds)";

// fetch has no timeout of its own. Without this, a connection that is accepted but never
// answered would leave the screen loading forever instead of falling back to offline.
const TIMEOUT_MS = 8000;

export type PointData = {
  county: string;
  zoneId: string;
  office: string;
  city: string;
  state: string;
};

// "Plantation, FL". The only readable part of a lookup — county and office come back as
// codes. Four different places needed this joined, so it lives beside the type.
export function formatPlace(point: PointData): string {
  return point.city + ", " + point.state;
}

// The API is JSON-LD, so these come back as full URLs and we only want the ID on the end.
function lastPart(url: string): string {
  const parts = url.split("/");
  return parts[parts.length - 1];
}

export async function fetchPointData(lat: number, lon: number): Promise<PointData | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`https://api.weather.gov/points/${lat},${lon}`, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const body = await response.json();
    const point = body.properties;
    const place = point.relativeLocation.properties;

    return {
      county: lastPart(point.county),
      zoneId: lastPart(point.forecastZone),
      office: point.cwa,
      city: place.city,
      state: place.state,
    };
  } catch {
    // No signal, NWS is down, or it ran past the timeout above. Onboarding carries on
    // without these.
    return null;
  } finally {
    // Runs whether we returned or threw, so a fast answer doesn't leave a timer pending.
    clearTimeout(timer);
  }
}

export type AlertData = {
  id: string;
  event: string;
  severity: string;
  headline: string;

  // When the hazard is expected to begin, and when the alert is over. Both ISO strings.
  // Most alerts are already underway by the time you read them, so onset is often past.
  onset: string | null;
  ends: string | null;

  // Which NWS office issued it, like 'NWS Miami FL'. Shown on the card so the alert
  // is attributed to the office that actually wrote it.
  senderName: string;
};

/**
 * The watches and warnings running in one forecast zone. An empty array means NWS
 * answered and nothing is active; null means we never reached it. The screen has to tell
 * those apart — 'all clear' and 'we don't know' are different things to say before a storm.
 */
export async function fetchActiveAlerts(zoneId: string): Promise<AlertData[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://api.weather.gov/alerts/active?zone=${zoneId}`,
      {
        headers: { "User-Agent": USER_AGENT },
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      return null;
    }

    const body = await response.json();
    const alerts = [];

    for (const feature of body.features) {
      const alert = feature.properties;
      alerts.push({
        id: alert.id,
        event: alert.event,
        severity: alert.severity,
        headline: alert.headline,

        onset: alert.onset ?? null,

        // A handful of alerts carry no 'ends'. 'expires' is always there, so it stands in.
        ends: alert.ends ?? alert.expires ?? null,

        senderName: alert.senderName,
      });
    }

    return alerts;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
