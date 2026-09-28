// Saves a phone's push token + NWS zone so poll-alerts knows who to warn. Called by the app.

import { withSupabase } from "npm:@supabase/server@^1";

// The only shapes we store. There's no login, so these checks are the gate.
const TOKEN_PATTERN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/;
const ZONE_PATTERN = /^[A-Z]{2}Z\d{3}$/;

export default {
  // 'publishable': the app sends the publishable key, which only proves it's our app.
  fetch: withSupabase({ auth: "publishable" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ error: "POST only" }, { status: 405 });
    }

    let body: { token?: unknown; zoneId?: unknown };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "bad json" }, { status: 400 });
    }

    const token = typeof body.token === "string" ? body.token : "";
    if (!TOKEN_PATTERN.test(token)) {
      return Response.json({ error: "bad token" }, { status: 400 });
    }

    // null zone = the phone turned notifications off, so stop sending to it.
    if (body.zoneId === null) {
      const { error } = await ctx.supabaseAdmin.from("push_tokens").delete().eq("expo_token", token);
      if (error) {
        return Response.json({ error: "delete failed" }, { status: 500 });
      }
      return Response.json({ ok: true });
    }

    const zoneId = typeof body.zoneId === "string" ? body.zoneId : "";
    if (!ZONE_PATTERN.test(zoneId)) {
      return Response.json({ error: "bad zone" }, { status: 400 });
    }

    // Upsert: the same phone re-registering (new zone, app relaunch) updates its one row.
    const { error } = await ctx.supabaseAdmin.from("push_tokens").upsert({
      expo_token: token,
      zone_id: zoneId,
      platform: "ios",
      updated_at: new Date().toISOString(),
    });
    if (error) {
      return Response.json({ error: "save failed" }, { status: 500 });
    }

    return Response.json({ ok: true });
  }),
};
