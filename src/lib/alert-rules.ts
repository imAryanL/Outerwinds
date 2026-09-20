// Turns what NWS sends back into what the Alerts screen shows — the severity, the alert
// worth showing, and its timeline. Plain rules, no network and no React; nws.ts fetches.

import type { AlertData } from "@/lib/nws";

export type AlertLevel = "calm" | "watch" | "warning";

// The events Outerwinds reacts to. NWS publishes plenty more — rip currents, dense fog,
// air quality — all real, none of them what this app is for. Turning the screen red for
// a fog advisory would spend the one color reserved for a storm.
const STORM_EVENTS = ["Hurricane", "Tropical Storm", "Storm Surge", "Flash Flood"];

function isStormEvent(event: string) {
  for (const kind of STORM_EVENTS) {
    if (event.includes(kind)) {
      return true;
    }
  }

  return false;
}

/**
 * The worst thing running, since the screen shows one state. A warning outranks a watch:
 * 'expected' is worse news than 'possible', and the more serious one is what to act on.
 */
export function levelFor(alerts: AlertData[]): AlertLevel {
  let level: AlertLevel = "calm";

  for (const alert of alerts) {
    if (!isStormEvent(alert.event)) {
      continue;
    }

    if (alert.event.includes("Warning")) {
      return "warning";
    }

    if (alert.event.includes("Watch")) {
      level = "watch";
    }
  }

  return level;
}

/**
 * The alert the card should show — the one that set the level above. Null on a calm day.
 * Picked here rather than in the screen so the badge can never name a different storm
 * than the colour behind it.
 */
export function topAlert(alerts: AlertData[]): AlertData | null {
  const level = levelFor(alerts);

  if (level === "calm") {
    return null;
  }

  for (const alert of alerts) {
    if (isStormEvent(alert.event) && alert.event.includes(matchWord(level))) {
      return alert;
    }
  }

  return null;
}

// 'warning' -> 'Warning', so the search matches how NWS capitalises its event names.
function matchWord(level: AlertLevel) {
  return level === "warning" ? "Warning" : "Watch";
}

// One row of the 'What to expect' card.
export type TimelineStep = {
  time: string;
  detail: string;
  isNow: boolean;
};

// 'Fri 9:15 PM'.
export function formatTime(iso: string) {
  const date = new Date(iso);

  const day = date.toLocaleDateString("en-US", { weekday: "short" });
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${day} ${time}`;
}

/**
 * The timeline for one alert, built only from times NWS actually sent. Rows are dropped
 * rather than invented: most alerts are already underway, so the middle row usually isn't
 * there at all. Nothing here describes what the weather will do — only when the alert
 * starts and stops, which is the part NWS states outright.
 */
export function timelineFor(alert: AlertData): TimelineStep[] {
  const steps: TimelineStep[] = [];

  // Always true, and it names the real event rather than assuming a hurricane.
  steps.push({
    time: "Now",
    detail: `${alert.event} in effect`,
    isNow: true,
  });

  // Only when it hasn't happened yet. A past onset would read as a forecast of something
  // that already started.
  if (alert.onset !== null && new Date(alert.onset) > new Date()) {
    steps.push({
      time: formatTime(alert.onset),
      detail: "Conditions expected to begin",
      isNow: false,
    });
  }

  if (alert.ends !== null) {
    steps.push({
      time: formatTime(alert.ends),
      detail: `${alert.event} expires`,
      isNow: false,
    });
  }

  return steps;
}
