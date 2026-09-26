import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-asset-path, x-asset-content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

const BUCKET = "a-profecia-assets";
const MAX_BYTES = 200 * 1024 * 1024;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getSecretKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const keys = JSON.parse(raw);
      if (keys?.default) return keys.default;
    } catch {}
  }
  throw new Error("Missing Supabase secret key");
}

function tokenFromRequest(req: Request) {
  const value = req.headers.get("authorization") || "";
  return value.replace(/^Bearer\s+/i, "").trim();
}

function allowedPath(path: string, role: string, playerId: string | null) {
  if (!path || path.length > 300 || path.startsWith("/") || path.includes("..") || path.includes("\\") || /[\u0000-\u001f]/.test(path)) {
    return false;
  }
  if (role === "master") {
    return /^(branding|backgrounds|slasher-music|music|sounds|tv)\//.test(path);
  }
  if (role === "player" && playerId) {
    return path.startsWith(`players/${playerId}/`);
  }
  return false;
}

function typeForPath(path: string, supplied: string) {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", jfif: "image/jpeg",
    webp: "image/webp", avif: "image/avif",
    mp3: "audio/mpeg", mpeg: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg",
    oga: "audio/ogg", opus: "audio/ogg", m4a: "audio/mp4", aac: "audio/aac", flac: "audio/flac",
    webm: "video/webm", mp4: "video/mp4", mov: "video/quicktime",
  };
  const expected = map[ext];
  if (!expected) return null;
  if (supplied && supplied !== "application/octet-stream") {
    const compatible = supplied === expected ||
      (supplied === "audio/webm" && expected === "video/webm");
    if (!compatible) return null;
  }
  return expected;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const token = tokenFromRequest(req);
  if (!token) return json({ error: "unauthorized" }, 401);

  const path = (req.headers.get("x-asset-path") || "").trim();
  const suppliedType = (req.headers.get("x-asset-content-type") || "").trim().toLowerCase();
  const contentType = typeForPath(path, suppliedType);
  if (!contentType) return json({ error: "unsupported_file_type" }, 415);

  const length = Number(req.headers.get("content-length") || 0);
  if (length > MAX_BYTES) return json({ error: "file_too_large" }, 413);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, getSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tokenHash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  const hash = [...new Uint8Array(tokenHash)].map((b) => b.toString(16).padStart(2, "0")).join("");

  const { data: session, error: sessionError } = await admin
    .from("a_profecia_sessions")
    .select("role,player_id,expires_at")
    .eq("token_hash", hash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (sessionError || !session) return json({ error: "unauthorized" }, 401);
  if (!allowedPath(path, session.role, session.player_id)) return json({ error: "forbidden" }, 403);

  const body = await req.arrayBuffer();
  if (!body.byteLength || body.byteLength > MAX_BYTES) return json({ error: "file_too_large" }, 413);

  const { error: uploadError } = await admin.storage.from(BUCKET).upload(
    path,
    body,
    { upsert: true, contentType, cacheControl: "31536000" },
  );
  if (uploadError) return json({ error: "upload_failed" }, 500);

  const { data: publicData } = admin.storage.from(BUCKET).getPublicUrl(path);
  return json({ ok: true, path, url: publicData.publicUrl });
});
