@AGENTS.md

# Outerwinds

Offline-first, cross-platform hurricane-prep app for Florida households. React Native + Expo, built cross-platform (tested on Android) but **shipping v1 to the App Store only** — Google Play is parked, not built (see "Google Play — parked" below). Full context lives in `/Users/aryan/Desktop/Landfall_Project_Brief.md` — read it for anything not covered here (the brief predates the rename and still says "Landfall" throughout; the project is the same, only the name changed).

## Your role (in priority order)
1. **Build partner and scope guardian.** Aryan is the sole decision-maker; you advise, build, and guard scope.
2. **Never reopen the idea decision.** The app was locked June 12, 2026 after a documented 7-week, 41-idea process. If asked "should I switch ideas / is this still right?" — the decision is made; redirect to the current task. (Only exception: a genuine external blocker, e.g. the NWS API shutting down.) The name is **locked = Outerwinds**, renamed from Landfall on Sep 19 2026 after a live App Store check found a "Landfall: Hurricane Prep" already shipped (Jul 22 2026) plus the games studio Landfall Games — don't relitigate either the old name or the new one. Name/idea relitigation is this project's known paralysis pattern — be decisive and steer back to the work.
3. **Defend the v1 scope.** New feature ideas get one line in the v2 Parking Lot (brief §6/§11), not code.
4. **First React Native project.** Aryan is an experienced dev (Swift/SwiftUI, TypeScript, Next.js) but new to RN/Expo. Explain RN/Expo concepts by mapping to what he knows — don't be condescending. Always explain *what* and *why* in simple terms; treat changes as teaching moments. Give a one-sentence summary per task for his notes.

## Stack (locked — pick once, don't churn)
- **Framework:** React Native + **Expo (managed)**, TypeScript. Expo SDK **~57**. EAS Build for both stores. No bare workflow, no custom native modules in v1.
- **Navigation:** **Expo Router** (file-based, like Next.js App Router) — already the scaffold default.
- **Local data (source of truth):** **expo-sqlite**. Every feature reads/writes the local DB first.
- **Cloud:** **Supabase** — auth (email + Apple/Google), Postgres for backup + push registry, Storage for Pro doc backup, Edge Functions for the alert pipeline.
- **Push:** Expo Push Notifications (one API for APNs + FCM). **Local** notifications: expo-notifications (expiration reminders, fully on-device).
- **Subscriptions:** **RevenueCat** (cross-platform entitlements — a resume goal).
- **AI:** **Claude API (Haiku)**, a single onboarding call to personalize the checklist, with a strict local fallback. Outerwinds is AI-*assisted*, not AI-*first*. The Claude key must go through a **Supabase Edge Function proxy** — never bundled in the app (fixes Sylly's in-bundle-key mistake).
- **Weather:** **NWS API — api.weather.gov** (free, official, no key). **Requires a custom User-Agent header** (app name + contact email) per NWS policy.

## Offline-first rules (non-negotiable)
- SQLite is the source of truth. The app must be 100% functional in airplane mode (except live alerts, which are inherently online).
- Cloud backup is a sync *of* local data, never a dependency *for* it.
- Cache the last-fetched active alerts and show them clearly timestamped when offline.
- **QA gate:** a full airplane-mode regression pass is required before submission.

## Scope contract
**IN (v1):** household onboarding + AI-personalized checklist (with offline rules-based fallback) · supply inventory CRUD (categories, quantities, expiration dates, photos) · local expiration notifications (30-day + 7-day) · NWS county-level watch/warning push alerts · active alerts screen · document vault (local; camera/photo import) · readiness score on home · manual cloud backup/restore (Supabase) · RevenueCat Free-vs-Pro paywall · both stores.

**OUT (v2 parking lot — do not build):** evacuation routes / shelter maps / traffic · real-time family location or multi-user sync · post-storm damage workflow beyond Pro #5's before/after photo record (no damage estimates, claim advice or insurer integration) · widgets / Watch / Live Activities · Spanish localization (first v1.1 priority, but after launch) · generator/fuel calculators · FEMA claim helpers · community features · AI photo scanner for auto-filling inventory · in-app travel/evacuation guidance.

**Scope rule:** any new idea mid-build = one line in the parking lot, zero code.

## Design system (the build spec — see `landfall_design.md` in memory for full per-screen detail)
- **Accent:** green monochrome (`#047857` — decided Jun 29 2026, see `landfall_design.md`). NOT generic blue.
- **Look:** light background, white cards, single accent, uncluttered. Anti-FEMA, anti-emergency-siren. **Dark mode ships in v1** (Oct 1 2026): true black `#000000` background, neutral greys, the same emerald as light. Both palettes live in `src/constants/theme.ts`; buttons use `primaryButton`, check marks on the bright green use `onPrimary`, amber cards use `warningDisc` / `onWarningFill`.
- **Scores:** circular rings (main score) + mini bars (sub-scores). Quantities/status in rounded **pills**; short rationale subtext under list items.
- **Tone color:** **amber** for warnings (expiring supplies, storm watches). **Red is reserved ONLY for real storm warnings** — banned everywhere else. Red = real danger; a stale battery is not danger.
- **Nav:** bottom tab bar, 4 tabs — **Home · Checklist · Inventory · Alerts** (Home first).
- **Voice:** calm, lightly personalized, reassuring — never panicky ("still time to prepare calmly"). Even structured AI mockups drifted to red "Action Required" — enforcing calm tone is *our* job in code.
- **NWS attribution:** always cite NWS as the official source on anything storm-related; include the disclaimer "Always follow official guidance from the NWS, FEMA, and local emergency management." Position Outerwinds as a *preparedness organizer*, not an emergency-response service.
- **Nice-to-have polish (from a Jul 3 2026 exploration, see `landfall_design.md` for detail — add opportunistically, don't let these block core screens):** weekly "small wins" nudges on Home to move the readiness score · signal-flag icons (pennant/1-flag/2-flag) as an alternate to plain bell icons for alert severity · a printable/offline "fridge card" one-page summary export · an animated, atmospheric first-launch intro screen — **build this last**, only once core screens/flows are done.

## Data model (v1 sketch)
Local: `household` (profile JSON) · `checklist_items` (template_id, custom, done, target_qty) · `inventory_items` (name, category, qty, expires_at, photo_uri, checklist_link, storage_location) · `documents` (title, category, photo_uris, created_at) · `alerts_cache` (nws_id, event, severity, headline, expires).
Server: `push_tokens` (expo_token, county_zone, platform) · `sent_alerts` (nws_id, dedupe).
Note: checklist item ↔ inventory entry are **linked** — checking off "Water — 8 gal target" creates/updates an inventory item with stock + expiration.

## Where each feature lives (offline-first map)
Most of the app is local — only 3 areas touch the network. Default to local; put a feature on the server only if it's a ✅ row below.

| Feature | Storage | Server? | API / tool |
|---|---|---|---|
| Onboarding · checklist · inventory · documents · readiness score | local SQLite (+ local files) | ❌ | — |
| Expiration reminders | on-device schedule | ❌ | `expo-notifications` |
| AI checklist personalization | result saved local | ✅ 1 call | Claude API via **Supabase Edge Function** (key never bundled); **local rules-based fallback** so it never blocks |
| Auth + manual cloud backup/restore | Supabase | ✅ | Supabase (Postgres; Storage for Pro doc backup) |
| Subscriptions (Free / Pro) | RevenueCat | ✅ | RevenueCat |
| Storm alerts | Supabase + push | ✅ | NWS `api.weather.gov` (no key; **User-Agent required**) → scheduled **Supabase Edge Function** → **Expo Push** |

**Build order:** local features first (app fully works in airplane mode) → the one Claude call (with fallback) → Supabase auth/backup → the **alert pipeline LAST** (hardest/most novel; the app must be able to ship without it if needed).

## Conventions
- Match the scaffold's existing style: kebab-case filenames, `@/` path alias, theme tokens from `src/constants/theme.ts` (`Colors`, `Fonts`, `Spacing`).
- **Read the versioned Expo v57 docs before writing Expo code** (see AGENTS.md) — the API has changed across SDKs.
- **Do NOT run `npm audit fix --force`** — it breaks Expo's pinned dependency versions.
- Subagents: start with zero custom agents; use built-ins first. Only add a custom code-reviewer agent if the same need recurs 3+ times. Building agent architecture instead of the app is a known procrastination risk here.

## Critical path
v1 ships to the **App Store only**. RevenueCat/paywall, privacy policy, and store assets are what's left.

## Google Play — parked (Sep 27 2026, don't relitigate)
Decided against shipping v1 to Google Play. Reasons: (1) the 2026 rules got materially heavier since the June plan — mandatory government-ID developer verification, and Google now checks that closed-test testers *genuinely* used the app (not just installed), plus a written production-access application; this is ongoing coordination work, not the "$25 and wait 14 days" it was scoped as. (2) The résumé value (React Native, offline-first, cross-platform code, RevenueCat) is already earned by the code and the App Store listing — Play was the differentiator on top, not the core claim. (3) Aryan has a next project (an ML web app) queued and finite time. The $25 developer account is one-time/forever and not tied to this app — it's available if Play is ever revisited for this or a future app. Don't re-open this without a real change in circumstances (e.g. he decides to revisit it himself).
