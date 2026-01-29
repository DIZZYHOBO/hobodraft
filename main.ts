const kv = await Deno.openKv();

function genId(): string { return crypto.randomUUID(); }

async function hash(pw: string): Promise<string> {
  const data = new TextEncoder().encode(pw + "hobodraft");
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function getCookie(req: Request, name: string): string | null {
  const c = req.headers.get("cookie") || "";
  const m = c.match(new RegExp(name + "=([^;]+)"));
  return m ? m[1] : null;
}

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  });
}

async function getUser(req: Request) {
  const token = getCookie(req, "session");
  if (!token) return null;
  const sess = await kv.get(["sessions", token]);
  if (!sess.value) return null;
  const s = sess.value as { uid: string; exp: string };
  if (new Date(s.exp) < new Date()) {
    await kv.delete(["sessions", token]);
    return null;
  }
  const user = await kv.get(["users", s.uid]);
  return user.value;
}

async function parseBody(req: Request) {
  try { return await req.json(); }
  catch { return {}; }
}

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff"
};

async function serveStatic(path: string): Promise<Response> {
  try {
    const file = await Deno.readFile("./static" + path);
    const ext = path.substring(path.lastIndexOf("."));
    return new Response(file, { 
      headers: { 
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000"
      } 
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const p = url.pathname;
  const m = req.method;

  // API Routes
  if (p === "/api/auth/register" && m === "POST") {
    const b = await parseBody(req);
    if (!b.username || !b.password) return json({ error: "Missing fields" }, 400);
    const username = b.username.toLowerCase().trim();
    if (username.length < 3) return json({ error: "Username too short" }, 400);
    const existing = await kv.get(["users_by_username", username]);
    if (existing.value) return json({ error: "Username taken" }, 400);
    const list = kv.list({ prefix: ["users"] });
    let count = 0;
    for await (const _ of list) count++;
    const id = genId();
    const user = { id, username, pw: await hash(b.password), role: count === 0 ? "admin" : "user" };
    await kv.set(["users", id], user);
    await kv.set(["users_by_username", username], id);
    const token = genId();
    await kv.set(["sessions", token], { uid: id, exp: new Date(Date.now() + 2592000000).toISOString() });
    return json({ success: true, user: { id, username, role: user.role } }, 200, {
      "Set-Cookie": "session=" + token + "; Path=/; HttpOnly; Max-Age=2592000; SameSite=Lax"
    });
  }

  if (p === "/api/auth/login" && m === "POST") {
    const b = await parseBody(req);
    if (!b.username || !b.password) return json({ error: "Missing fields" }, 400);
    const username = b.username.toLowerCase().trim();
    const uidRes = await kv.get(["users_by_username", username]);
    if (!uidRes.value) return json({ error: "Invalid credentials" }, 401);
    const userRes = await kv.get(["users", uidRes.value as string]);
    if (!userRes.value) return json({ error: "Invalid credentials" }, 401);
    const user = userRes.value as { id: string; username: string; pw: string; role: string };
    if (user.pw !== await hash(b.password)) return json({ error: "Invalid credentials" }, 401);
    const token = genId();
    await kv.set(["sessions", token], { uid: user.id, exp: new Date(Date.now() + 2592000000).toISOString() });
    return json({ success: true, user: { id: user.id, username: user.username, role: user.role } }, 200, {
      "Set-Cookie": "session=" + token + "; Path=/; HttpOnly; Max-Age=2592000; SameSite=Lax"
    });
  }

  if (p === "/api/auth/logout" && m === "POST") {
    const token = getCookie(req, "session");
    if (token) await kv.delete(["sessions", token]);
    return json({ success: true }, 200, { "Set-Cookie": "session=; Path=/; Max-Age=0" });
  }

  if (p === "/api/auth/me") {
    const u = await getUser(req) as { id: string; username: string; role: string } | null;
    return json(u ? { user: { id: u.id, username: u.username, role: u.role } } : { user: null });
  }

  if (p === "/api/scripts" && m === "GET") {
    const u = await getUser(req) as { id: string } | null;
    if (!u) return json({ error: "Unauthorized" }, 401);
    const list: unknown[] = [];
    for await (const entry of kv.list({ prefix: ["scripts_by_owner", u.id] })) {
      const sid = entry.key[2] as string;
      const script = await kv.get(["scripts", sid]);
      if (script.value) list.push(script.value);
    }
    list.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return json({ scripts: list });
  }

  if (p === "/api/scripts" && m === "POST") {
    const u = await getUser(req) as { id: string; username: string } | null;
    if (!u) return json({ error: "Unauthorized" }, 401);
    const b = await parseBody(req);
    const id = genId();
    const now = new Date().toISOString();
    const script = {
      id, title: b.title || "Untitled", type: b.type || "feature", ownerId: u.id,
      createdAt: now, updatedAt: now,
      content: { elements: [{ id: genId(), type: "scene-heading", content: "INT. LOCATION - DAY" }], titlePage: { title: b.title || "Untitled", writtenBy: u.username } },
      characters: [], locations: []
    };
    await kv.set(["scripts", id], script);
    await kv.set(["scripts_by_owner", u.id, id], true);
    return json({ success: true, script });
  }

  const sm = p.match(/^\/api\/scripts\/([a-f0-9-]+)$/);
  if (sm) {
    const u = await getUser(req) as { id: string } | null;
    if (!u) return json({ error: "Unauthorized" }, 401);
    const res = await kv.get(["scripts", sm[1]]);
    if (!res.value) return json({ error: "Not found" }, 404);
    const s = res.value as { ownerId: string; content: unknown; characters: unknown; locations: unknown; title?: string };
    if (s.ownerId !== u.id) return json({ error: "Forbidden" }, 403);
    if (m === "GET") return json({ script: s, content: s.content, characters: s.characters, locations: s.locations });
    if (m === "PUT") {
      const b = await parseBody(req);
      if (b.title !== undefined) s.title = b.title;
      (s as any).updatedAt = new Date().toISOString();
      await kv.set(["scripts", sm[1]], s);
      return json({ success: true, script: s });
    }
    if (m === "DELETE") {
      await kv.delete(["scripts", sm[1]]);
      await kv.delete(["scripts_by_owner", u.id, sm[1]]);
      return json({ success: true });
    }
  }

  const cm = p.match(/^\/api\/scripts\/([a-f0-9-]+)\/content$/);
  if (cm && m === "PUT") {
    const u = await getUser(req) as { id: string } | null;
    if (!u) return json({ error: "Unauthorized" }, 401);
    const res = await kv.get(["scripts", cm[1]]);
    if (!res.value) return json({ error: "Not found" }, 404);
    const s = res.value as { ownerId: string; content?: unknown };
    if (s.ownerId !== u.id) return json({ error: "Forbidden" }, 403);
    const b = await parseBody(req);
    s.content = b.content;
    (s as any).updatedAt = new Date().toISOString();
    await kv.set(["scripts", cm[1]], s);
    return json({ success: true });
  }

  if (p === "/api/admin/users") {
    const u = await getUser(req) as { role: string } | null;
    if (!u || u.role !== "admin") return json({ error: "Forbidden" }, 403);
    const list: unknown[] = [];
    for await (const entry of kv.list({ prefix: ["users"] })) {
      const x = entry.value as { id: string; username: string; role: string };
      list.push({ id: x.id, username: x.username, role: x.role });
    }
    return json({ users: list });
  }

  if (p === "/api/admin/stats") {
    const u = await getUser(req) as { role: string } | null;
    if (!u || u.role !== "admin") return json({ error: "Forbidden" }, 403);
    let uc = 0, sc = 0, ac = 0;
    for await (const entry of kv.list({ prefix: ["users"] })) {
      uc++;
      if ((entry.value as { role: string }).role === "admin") ac++;
    }
    for await (const _ of kv.list({ prefix: ["scripts"] })) sc++;
    return json({ stats: { users: uc, scripts: sc, admins: ac } });
  }

  if (p.startsWith("/api/")) return json({ error: "Not found" }, 404);

  // Static files
  if (p.includes(".")) {
    return serveStatic(p);
  }

  // SPA fallback - serve index.html for all routes
  return serveStatic("/index.html");
}

Deno.serve({ port: Number(Deno.env.get("PORT")) || 8000 }, handler);
