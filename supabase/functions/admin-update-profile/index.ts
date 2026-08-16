import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const allowedOrigins = new Set([
  "https://logicaspxg.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:5500",
]);

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://logicaspxg.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json" },
  });
}

function envKey(jsonName: string, legacyName: string) {
  const bundled = Deno.env.get(jsonName);
  if (bundled) {
    const parsed = JSON.parse(bundled);
    if (parsed.default) return parsed.default as string;
  }
  const legacy = Deno.env.get(legacyName);
  if (!legacy) throw new Error(`Variável ${legacyName} indisponível.`);
  return legacy;
}

function cleanUsername(value: unknown) {
  const username = String(value ?? "").trim();
  if (username.length < 3 || username.length > 24 || !/^[A-Za-zÀ-ÿ0-9_. \-]+$/.test(username)) {
    throw new Error("Nome de usuário inválido.");
  }
  return username;
}

function cleanBio(value: unknown) {
  if (value == null || String(value).trim() === "") return null;
  const bio = String(value).trim();
  if (bio.length > 280) throw new Error("A bio deve ter no máximo 280 caracteres.");
  return bio;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Método não permitido." }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json(req, { error: "Sessão obrigatória." }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const publishableKey = envKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
    const secretKey = envKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");

    const userClient = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    const actor = authData.user;
    if (authError || !actor?.email) return json(req, { error: "Sessão inválida." }, 401);

    const body = await req.json();
    const targetId = String(body.targetId || "");
    const password = String(body.password || "");
    if (!/^[0-9a-f-]{36}$/i.test(targetId) || !password) {
      return json(req, { error: "Perfil e senha são obrigatórios." }, 400);
    }

    const admin = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: actorProfile, error: actorProfileError } = await admin
      .from("profiles")
      .select("id,username,role")
      .eq("id", actor.id)
      .single();
    if (actorProfileError || actorProfile?.role !== "admin") {
      return json(req, { error: "Acesso restrito a administradores." }, 403);
    }

    const verifier = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: verified, error: passwordError } = await verifier.auth.signInWithPassword({
      email: actor.email,
      password,
    });
    if (passwordError || verified.user?.id !== actor.id) {
      return json(req, { error: "Senha do administrador incorreta." }, 401);
    }
    await verifier.auth.signOut();

    const { data: before, error: targetError } = await admin
      .from("profiles")
      .select("id,username,avatar_url,bio,role,created_at,username_changed_at")
      .eq("id", targetId)
      .single();
    if (targetError || !before) return json(req, { error: "Perfil não encontrado." }, 404);

    const username = cleanUsername(body.username);
    const bio = cleanBio(body.bio);
    const role = body.role === "admin" ? "admin" : "user";
    const { data: sameUsername, error: usernameError } = await admin
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .neq("id", targetId)
      .limit(1);
    if (usernameError) throw usernameError;
    if (sameUsername?.length) return json(req, { error: "Esse nome de usuário já está em uso." }, 409);
    if (targetId === actor.id && role !== before.role) {
      return json(req, { error: "Você não pode alterar sua própria função." }, 400);
    }
    if (before.role === "admin" && role === "user") {
      const { count, error: countError } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");
      if (countError) throw countError;
      if ((count || 0) <= 1) return json(req, { error: "O último administrador não pode ser removido." }, 400);
    }

    let avatarUrl = before.avatar_url as string | null;
    const removeAvatar = Boolean(body.removeAvatar);
    const avatar = body.avatar;
    if (removeAvatar || avatar) {
      const { data: existing, error: listError } = await admin.storage.from("avatars").list(targetId, { limit: 100 });
      if (listError) throw listError;
      const paths = (existing || []).map((file) => `${targetId}/${file.name}`);
      if (paths.length) {
        const { error: removeError } = await admin.storage.from("avatars").remove(paths);
        if (removeError) throw removeError;
      }
      avatarUrl = null;
    }

    if (avatar) {
      const mimeType = String(avatar.mimeType || "");
      const extByMime: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
      const ext = extByMime[mimeType];
      if (!ext || typeof avatar.base64 !== "string") return json(req, { error: "Formato de imagem inválido." }, 400);
      const bytes = Uint8Array.from(atob(avatar.base64), (char) => char.charCodeAt(0));
      if (bytes.byteLength > 2 * 1024 * 1024) return json(req, { error: "A imagem deve ter no máximo 2 MB." }, 400);
      const path = `${targetId}/avatar-${Date.now()}.${ext}`;
      const { error: uploadError } = await admin.storage.from("avatars").upload(path, bytes, {
        contentType: mimeType,
        cacheControl: "3600",
        upsert: false,
      });
      if (uploadError) throw uploadError;
      avatarUrl = admin.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    }

    const updates = { username, bio, role, avatar_url: avatarUrl };
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    for (const field of ["username", "bio", "role", "avatar_url"] as const) {
      if (before[field] !== updates[field]) changes[field] = { before: before[field], after: updates[field] };
    }
    if (!Object.keys(changes).length) return json(req, { profile: before, unchanged: true });

    const { data: profile, error: updateError } = await admin
      .from("profiles")
      .update(updates)
      .eq("id", targetId)
      .select("id,username,avatar_url,bio,role,created_at,username_changed_at")
      .single();
    if (updateError) {
      if (updateError.code === "23505") return json(req, { error: "Esse nome de usuário já está em uso." }, 409);
      throw updateError;
    }

    const { error: auditError } = await admin.from("admin_profile_audit").insert({
      actor_id: actor.id,
      actor_username: actorProfile.username,
      target_id: targetId,
      target_username: profile.username,
      changes,
    });
    if (auditError) throw auditError;

    return json(req, { profile });
  } catch (error) {
    console.error("admin-update-profile failed", error instanceof Error ? error.message : "unknown");
    return json(req, { error: error instanceof Error ? error.message : "Erro interno." }, 500);
  }
});

