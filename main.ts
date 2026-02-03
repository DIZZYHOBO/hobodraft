const kv = await Deno.openKv();

function genId(): string { return crypto.randomUUID(); }
function genShareToken(): string { return crypto.randomUUID().replace(/-/g, '').slice(0, 12); }

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

function getDefaultElement(type: string): { type: string; content: string } {
  const t = type.toLowerCase();
  if (t === 'poetry' || t === 'poem') {
    return { type: 'poem-title', content: 'Untitled Poem' };
  }
  if (t === 'fiction' || t === 'novel' || t === 'short-story') {
    return { type: 'chapter-heading', content: 'Chapter One' };
  }
  return { type: 'scene-heading', content: 'INT. LOCATION - DAY' };
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

function countScriptWords(content: any): number {
  if (!content?.elements) return 0;
  return content.elements.reduce((sum: number, el: any) => sum + countWords(el.content || ''), 0);
}

function extractCharactersAndLocations(content: any): { characters: string[], locations: string[] } {
  const characters = new Set<string>();
  const locations = new Set<string>();
  
  if (!content?.elements) return { characters: [], locations: [] };
  
  for (const el of content.elements) {
    if (el.type === 'character' && el.content) {
      characters.add(el.content.toUpperCase().trim());
    }
    if (el.type === 'scene-heading' && el.content) {
      const match = el.content.match(/(?:INT\.|EXT\.|INT\/EXT\.)\s*(.+?)(?:\s*-\s*(?:DAY|NIGHT|MORNING|EVENING|LATER|CONTINUOUS))?$/i);
      if (match) locations.add(match[1].trim().toUpperCase());
    }
  }
  
  return { characters: Array.from(characters).sort(), locations: Array.from(locations).sort() };
}

function analyzeScript(content: any): any {
  if (!content?.elements) return { totalWords: 0, dialogueWords: 0, actionWords: 0, sceneCount: 0, characterDialogue: {} };
  
  let totalWords = 0, dialogueWords = 0, actionWords = 0, sceneCount = 0;
  const characterDialogue: Record<string, number> = {};
  let currentCharacter = '';
  
  for (const el of content.elements) {
    const words = countWords(el.content || '');
    totalWords += words;
    
    if (el.type === 'scene-heading') sceneCount++;
    if (el.type === 'character') currentCharacter = (el.content || '').toUpperCase().trim();
    if (el.type === 'dialogue') {
      dialogueWords += words;
      if (currentCharacter) {
        characterDialogue[currentCharacter] = (characterDialogue[currentCharacter] || 0) + words;
      }
    }
    if (el.type === 'action') actionWords += words;
  }
  
  return { totalWords, dialogueWords, actionWords, sceneCount, characterDialogue };
}

const MIME: Record<string, string> = {
  ".html": "text/html", ".css": "text/css", ".js": "application/javascript",
  ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff"
};

async function serveStatic(path: string): Promise<Response> {
  try {
    const file = await Deno.readFile("./static" + path);
    const ext = path.substring(path.lastIndexOf("."));
    return new Response(file, { 
      headers: { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": "public, max-age=31536000" } 
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const p = url.pathname;
  const m = req.method;

  // ===== AUTH =====
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
    const now = new Date().toISOString();
    const isFirstUser = count === 0;
    
    const user = { 
      id, username, pw: await hash(b.password), 
      role: isFirstUser ? "admin" : "user",
      status: isFirstUser ? "approved" : "pending",
      createdAt: now,
      preferences: { theme: 'dark', fontSize: 14 }
    };
    
    await kv.set(["users", id], user);
    await kv.set(["users_by_username", username], id);
    
    if (isFirstUser) {
      const token = genId();
      await kv.set(["sessions", token], { uid: id, exp: new Date(Date.now() + 2592000000).toISOString() });
      return json({ success: true, user: { id, username, role: user.role, status: user.status } }, 200, {
        "Set-Cookie": "session=" + token + "; Path=/; HttpOnly; Max-Age=2592000; SameSite=Lax"
      });
    } else {
      return json({ success: true, pending: true, message: "Registration submitted. Please wait for admin approval." });
    }
  }

  if (p === "/api/auth/login" && m === "POST") {
    const b = await parseBody(req);
    if (!b.username || !b.password) return json({ error: "Missing fields" }, 400);
    const username = b.username.toLowerCase().trim();
    const uidRes = await kv.get(["users_by_username", username]);
    if (!uidRes.value) return json({ error: "Invalid credentials" }, 401);
    const userRes = await kv.get(["users", uidRes.value as string]);
    if (!userRes.value) return json({ error: "Invalid credentials" }, 401);
    const user = userRes.value as any;
    if (user.pw !== await hash(b.password)) return json({ error: "Invalid credentials" }, 401);
    if (user.status === "pending") return json({ error: "Your account is pending admin approval" }, 403);
    
    const token = genId();
    await kv.set(["sessions", token], { uid: user.id, exp: new Date(Date.now() + 2592000000).toISOString() });
    return json({ success: true, user: { id: user.id, username: user.username, role: user.role, preferences: user.preferences } }, 200, {
      "Set-Cookie": "session=" + token + "; Path=/; HttpOnly; Max-Age=2592000; SameSite=Lax"
    });
  }

  if (p === "/api/auth/logout" && m === "POST") {
    const token = getCookie(req, "session");
    if (token) await kv.delete(["sessions", token]);
    return json({ success: true }, 200, { "Set-Cookie": "session=; Path=/; Max-Age=0" });
  }

  if (p === "/api/auth/me") {
    const u = await getUser(req) as any;
    return json(u ? { user: { id: u.id, username: u.username, role: u.role, preferences: u.preferences } } : { user: null });
  }

  // ===== USER PREFERENCES =====
  if (p === "/api/preferences" && m === "PUT") {
    const u = await getUser(req) as any;
    if (!u) return json({ error: "Unauthorized" }, 401);
    const b = await parseBody(req);
    u.preferences = { ...u.preferences, ...b };
    await kv.set(["users", u.id], u);
    return json({ success: true, preferences: u.preferences });
  }

  // ===== WRITING STATS =====
  if (p === "/api/stats" && m === "GET") {
    const u = await getUser(req) as any;
    if (!u) return json({ error: "Unauthorized" }, 401);
    const statsRes = await kv.get(["writing_stats", u.id]);
    const stats = statsRes.value || { dailyWords: {}, streak: 0, lastWriteDate: null, totalWords: 0 };
    return json({ stats });
  }

  if (p === "/api/stats" && m === "POST") {
    const u = await getUser(req) as any;
    if (!u) return json({ error: "Unauthorized" }, 401);
    const b = await parseBody(req);
    const statsRes = await kv.get(["writing_stats", u.id]);
    const stats = (statsRes.value as any) || { dailyWords: {}, streak: 0, lastWriteDate: null, totalWords: 0 };
    
    const today = new Date().toISOString().split('T')[0];
    const prevWords = stats.dailyWords[today] || 0;
    stats.dailyWords[today] = b.wordsToday || 0;
    stats.totalWords = (stats.totalWords || 0) + (b.wordsToday - prevWords);
    
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (stats.lastWriteDate === yesterday || stats.lastWriteDate === today) {
      if (stats.lastWriteDate !== today) stats.streak = (stats.streak || 0) + 1;
    } else if (stats.lastWriteDate !== today) {
      stats.streak = 1;
    }
    stats.lastWriteDate = today;
    
    await kv.set(["writing_stats", u.id], stats);
    return json({ success: true, stats });
  }

  // ===== FOLDERS =====
  if (p === "/api/folders" && m === "GET") {
    const u = await getUser(req) as any;
    if (!u) return json({ error: "Unauthorized" }, 401);
    const list: any[] = [];
    for await (const entry of kv.list({ prefix: ["folders", u.id] })) {
      list.push(entry.value);
    }
    list.sort((a, b) => a.name.localeCompare(b.name));
    return json({ folders: list });
  }

  if (p === "/api/folders" && m === "POST") {
    const u = await getUser(req) as any;
    if (!u) return json({ error: "Unauthorized" }, 401);
    const b = await parseBody(req);
    const id = genId();
    const folder = { id, name: b.name || "New Folder", ownerId: u.id, createdAt: new Date().toISOString() };
    await kv.set(["folders", u.id, id], folder);
    return json({ success: true, folder });
  }

  const folderMatch = p.match(/^\/api\/folders\/([a-f0-9-]+)$/);
  if (folderMatch) {
    const u = await getUser(req) as any;
    if (!u) return json({ error: "Unauthorized" }, 401);
    const fid = folderMatch[1];
    
    if (m === "PUT") {
      const b = await parseBody(req);
      const res = await kv.get(["folders", u.id, fid]);
      if (!res.value) return json({ error: "Not found" }, 404);
      const folder = res.value as any;
      folder.name = b.name || folder.name;
      await kv.set(["folders", u.id, fid], folder);
      return json({ success: true, folder });
    }
    
    if (m === "DELETE") {
      await kv.delete(["folders", u.id, fid]);
      for await (const entry of kv.list({ prefix: ["scripts_by_owner", u.id] })) {
        const sid = entry.key[2] as string;
        const script = await kv.get(["scripts", sid]);
        if (script.value && (script.value as any).folderId === fid) {
          (script.value as any).folderId = null;
          await kv.set(["scripts", sid], script.value);
        }
      }
      return json({ success: true });
    }
  }

  // ===== SCRIPTS =====
  if (p === "/api/scripts" && m === "GET") {
    const u = await getUser(req) as any;
    if (!u) return json({ error: "Unauthorized" }, 401);
    const list: any[] = [];
    for await (const entry of kv.list({ prefix: ["scripts_by_owner", u.id] })) {
      const sid = entry.key[2] as string;
      const script = await kv.get(["scripts", sid]);
      if (script.value) {
        const s = script.value as any;
        list.push({
          id: s.id, title: s.title, type: s.type, folderId: s.folderId,
          createdAt: s.createdAt, updatedAt: s.updatedAt,
          wordCount: countScriptWords(s.content), shareToken: s.shareToken
        });
      }
    }
    list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return json({ scripts: list });
  }

  if (p === "/api/scripts" && m === "POST") {
    const u = await getUser(req) as any;
    if (!u) return json({ error: "Unauthorized" }, 401);
    const b = await parseBody(req);
    const id = genId();
    const now = new Date().toISOString();
    const docType = b.type || "feature";
    const defaultEl = getDefaultElement(docType);
    const script = {
      id, title: b.title || "Untitled", type: docType, ownerId: u.id,
      folderId: b.folderId || null,
      createdAt: now, updatedAt: now,
      content: { 
        elements: [{ id: genId(), type: defaultEl.type, content: defaultEl.content }], 
        titlePage: { title: b.title || "Untitled", writtenBy: u.username, contact: '', draft: '', date: now.split('T')[0] } 
      },
      characters: [], locations: [], comments: [], versions: [],
      shareToken: null, shareMode: null
    };
    await kv.set(["scripts", id], script);
    await kv.set(["scripts_by_owner", u.id, id], true);
    return json({ success: true, script: { ...script, wordCount: 0 } });
  }

  if (p === "/api/scripts/search" && m === "GET") {
    const u = await getUser(req) as any;
    if (!u) return json({ error: "Unauthorized" }, 401);
    const query = url.searchParams.get("q")?.toLowerCase() || "";
    const results: any[] = [];
    
    for await (const entry of kv.list({ prefix: ["scripts_by_owner", u.id] })) {
      const sid = entry.key[2] as string;
      const script = await kv.get(["scripts", sid]);
      if (script.value) {
        const s = script.value as any;
        const matches: any[] = [];
        
        if (s.title.toLowerCase().includes(query)) {
          matches.push({ type: 'title', text: s.title });
        }
        
        if (s.content?.elements) {
          for (const el of s.content.elements) {
            if (el.content?.toLowerCase().includes(query)) {
              matches.push({ type: el.type, text: el.content, elementId: el.id });
            }
          }
        }
        
        if (matches.length > 0) {
          results.push({ id: s.id, title: s.title, type: s.type, matches: matches.slice(0, 5) });
        }
      }
    }
    return json({ results });
  }

  const sm = p.match(/^\/api\/scripts\/([a-f0-9-]+)$/);
  if (sm) {
    const u = await getUser(req) as any;
    if (!u) return json({ error: "Unauthorized" }, 401);
    const res = await kv.get(["scripts", sm[1]]);
    if (!res.value) return json({ error: "Not found" }, 404);
    const s = res.value as any;
    if (s.ownerId !== u.id) return json({ error: "Forbidden" }, 403);
    
    if (m === "GET") {
      const extracted = extractCharactersAndLocations(s.content);
      const analysis = analyzeScript(s.content);
      return json({ 
        script: s, content: s.content, 
        characters: extracted.characters, locations: extracted.locations,
        comments: s.comments || [], versions: (s.versions || []).map((v: any) => ({ id: v.id, name: v.name, createdAt: v.createdAt, wordCount: v.wordCount })),
        analysis
      });
    }
    
    if (m === "PUT") {
      const b = await parseBody(req);
      if (b.title !== undefined) s.title = b.title;
      if (b.folderId !== undefined) s.folderId = b.folderId;
      if (b.titlePage !== undefined) s.content.titlePage = { ...s.content.titlePage, ...b.titlePage };
      s.updatedAt = new Date().toISOString();
      await kv.set(["scripts", sm[1]], s);
      return json({ success: true, script: s });
    }
    
    if (m === "DELETE") {
      await kv.delete(["scripts", sm[1]]);
      await kv.delete(["scripts_by_owner", u.id, sm[1]]);
      if (s.shareToken) await kv.delete(["shares", s.shareToken]);
      return json({ success: true });
    }
  }

  const cm = p.match(/^\/api\/scripts\/([a-f0-9-]+)\/content$/);
  if (cm && m === "PUT") {
    const u = await getUser(req) as any;
    if (!u) return json({ error: "Unauthorized" }, 401);
    const res = await kv.get(["scripts", cm[1]]);
    if (!res.value) return json({ error: "Not found" }, 404);
    const s = res.value as any;
    if (s.ownerId !== u.id) return json({ error: "Forbidden" }, 403);
    const b = await parseBody(req);
    s.content = b.content;
    s.updatedAt = new Date().toISOString();
    await kv.set(["scripts", cm[1]], s);
    
    const extracted = extractCharactersAndLocations(s.content);
    return json({ success: true, characters: extracted.characters, locations: extracted.locations });
  }

  // Versions
  const vm = p.match(/^\/api\/scripts\/([a-f0-9-]+)\/versions$/);
  if (vm) {
    const u = await getUser(req) as any;
    if (!u) return json({ error: "Unauthorized" }, 401);
    const res = await kv.get(["scripts", vm[1]]);
    if (!res.value) return json({ error: "Not found" }, 404);
    const s = res.value as any;
    if (s.ownerId !== u.id) return json({ error: "Forbidden" }, 403);
    
    if (m === "POST") {
      const b = await parseBody(req);
      if (!s.versions) s.versions = [];
      const version = {
        id: genId(),
        name: b.name || `Version ${s.versions.length + 1}`,
        createdAt: new Date().toISOString(),
        content: JSON.parse(JSON.stringify(s.content)),
        wordCount: countScriptWords(s.content)
      };
      s.versions.push(version);
      if (s.versions.length > 20) s.versions = s.versions.slice(-20);
      await kv.set(["scripts", vm[1]], s);
      return json({ success: true, version: { id: version.id, name: version.name, createdAt: version.createdAt, wordCount: version.wordCount } });
    }
  }

  const vdm = p.match(/^\/api\/scripts\/([a-f0-9-]+)\/versions\/([a-f0-9-]+)$/);
  if (vdm) {
    const u = await getUser(req) as any;
    if (!u) return json({ error: "Unauthorized" }, 401);
    const res = await kv.get(["scripts", vdm[1]]);
    if (!res.value) return json({ error: "Not found" }, 404);
    const s = res.value as any;
    if (s.ownerId !== u.id) return json({ error: "Forbidden" }, 403);
    
    const version = (s.versions || []).find((v: any) => v.id === vdm[2]);
    if (!version) return json({ error: "Version not found" }, 404);
    
    if (m === "GET") return json({ version });
    
    if (m === "POST") {
      s.content = JSON.parse(JSON.stringify(version.content));
      s.updatedAt = new Date().toISOString();
      await kv.set(["scripts", vdm[1]], s);
      return json({ success: true, content: s.content });
    }
    
    if (m === "DELETE") {
      s.versions = (s.versions || []).filter((v: any) => v.id !== vdm[2]);
      await kv.set(["scripts", vdm[1]], s);
      return json({ success: true });
    }
  }

  // Comments
  const commentsMatch = p.match(/^\/api\/scripts\/([a-f0-9-]+)\/comments$/);
  if (commentsMatch) {
    const u = await getUser(req) as any;
    if (!u) return json({ error: "Unauthorized" }, 401);
    const res = await kv.get(["scripts", commentsMatch[1]]);
    if (!res.value) return json({ error: "Not found" }, 404);
    const s = res.value as any;
    if (s.ownerId !== u.id) return json({ error: "Forbidden" }, 403);
    
    if (m === "GET") return json({ comments: s.comments || [] });
    
    if (m === "POST") {
      const b = await parseBody(req);
      if (!s.comments) s.comments = [];
      const comment = {
        id: genId(),
        elementId: b.elementId,
        text: b.text,
        color: b.color || 'yellow',
        createdAt: new Date().toISOString(),
        resolved: false
      };
      s.comments.push(comment);
      await kv.set(["scripts", commentsMatch[1]], s);
      return json({ success: true, comment });
    }
  }

  const commentMatch = p.match(/^\/api\/scripts\/([a-f0-9-]+)\/comments\/([a-f0-9-]+)$/);
  if (commentMatch) {
    const u = await getUser(req) as any;
    if (!u) return json({ error: "Unauthorized" }, 401);
    const res = await kv.get(["scripts", commentMatch[1]]);
    if (!res.value) return json({ error: "Not found" }, 404);
    const s = res.value as any;
    if (s.ownerId !== u.id) return json({ error: "Forbidden" }, 403);
    
    if (m === "PUT") {
      const b = await parseBody(req);
      const comment = (s.comments || []).find((c: any) => c.id === commentMatch[2]);
      if (!comment) return json({ error: "Comment not found" }, 404);
      if (b.text !== undefined) comment.text = b.text;
      if (b.resolved !== undefined) comment.resolved = b.resolved;
      if (b.color !== undefined) comment.color = b.color;
      await kv.set(["scripts", commentMatch[1]], s);
      return json({ success: true, comment });
    }
    
    if (m === "DELETE") {
      s.comments = (s.comments || []).filter((c: any) => c.id !== commentMatch[2]);
      await kv.set(["scripts", commentMatch[1]], s);
      return json({ success: true });
    }
  }

  // Sharing
  const shareMatch = p.match(/^\/api\/scripts\/([a-f0-9-]+)\/share$/);
  if (shareMatch) {
    const u = await getUser(req) as any;
    if (!u) return json({ error: "Unauthorized" }, 401);
    const res = await kv.get(["scripts", shareMatch[1]]);
    if (!res.value) return json({ error: "Not found" }, 404);
    const s = res.value as any;
    if (s.ownerId !== u.id) return json({ error: "Forbidden" }, 403);
    
    if (m === "POST") {
      const b = await parseBody(req);
      if (!s.shareToken) s.shareToken = genShareToken();
      s.shareMode = b.mode || 'read';
      await kv.set(["scripts", shareMatch[1]], s);
      await kv.set(["shares", s.shareToken], { scriptId: s.id, mode: s.shareMode });
      return json({ success: true, shareToken: s.shareToken, shareMode: s.shareMode });
    }
    
    if (m === "DELETE") {
      if (s.shareToken) await kv.delete(["shares", s.shareToken]);
      s.shareToken = null;
      s.shareMode = null;
      await kv.set(["scripts", shareMatch[1]], s);
      return json({ success: true });
    }
  }

  // Public shared script access
  const sharedMatch = p.match(/^\/api\/shared\/([a-z0-9]+)$/);
  if (sharedMatch) {
    const shareRes = await kv.get(["shares", sharedMatch[1]]);
    if (!shareRes.value) return json({ error: "Share link not found or expired" }, 404);
    const share = shareRes.value as any;
    const scriptRes = await kv.get(["scripts", share.scriptId]);
    if (!scriptRes.value) return json({ error: "Script not found" }, 404);
    const s = scriptRes.value as any;
    
    if (m === "GET") {
      return json({ 
        script: { id: s.id, title: s.title, type: s.type },
        content: s.content,
        mode: share.mode,
        analysis: analyzeScript(s.content)
      });
    }
    
    if (m === "PUT" && share.mode === 'edit') {
      const b = await parseBody(req);
      s.content = b.content;
      s.updatedAt = new Date().toISOString();
      await kv.set(["scripts", share.scriptId], s);
      return json({ success: true });
    }
  }

  // ===== ADMIN =====
  if (p === "/api/admin/users" && m === "GET") {
    const u = await getUser(req) as any;
    if (!u || u.role !== "admin") return json({ error: "Forbidden" }, 403);
    const list: any[] = [];
    for await (const entry of kv.list({ prefix: ["users"] })) {
      const x = entry.value as any;
      list.push({ id: x.id, username: x.username, role: x.role, status: x.status || 'approved', createdAt: x.createdAt || '' });
    }
    list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return json({ users: list });
  }

  const um = p.match(/^\/api\/admin\/users\/([a-f0-9-]+)$/);
  if (um) {
    const u = await getUser(req) as any;
    if (!u || u.role !== "admin") return json({ error: "Forbidden" }, 403);
    const userRes = await kv.get(["users", um[1]]);
    if (!userRes.value) return json({ error: "User not found" }, 404);
    
    if (m === "PUT") {
      const b = await parseBody(req);
      const user = userRes.value as any;
      if (b.role !== undefined) user.role = b.role;
      if (b.status !== undefined) user.status = b.status;
      await kv.set(["users", um[1]], user);
      return json({ success: true, user: { id: user.id, username: user.username, role: user.role, status: user.status } });
    }
    
    if (m === "DELETE") {
      if (um[1] === u.id) return json({ error: "Cannot delete yourself" }, 400);
      const user = userRes.value as any;
      for await (const entry of kv.list({ prefix: ["scripts_by_owner", um[1]] })) {
        const sid = entry.key[2] as string;
        const script = await kv.get(["scripts", sid]);
        if (script.value && (script.value as any).shareToken) {
          await kv.delete(["shares", (script.value as any).shareToken]);
        }
        await kv.delete(["scripts", sid]);
        await kv.delete(["scripts_by_owner", um[1], sid]);
      }
      await kv.delete(["users", um[1]]);
      await kv.delete(["users_by_username", user.username]);
      await kv.delete(["writing_stats", um[1]]);
      for await (const entry of kv.list({ prefix: ["folders", um[1]] })) {
        await kv.delete(entry.key);
      }
      return json({ success: true });
    }
  }

  if (p === "/api/admin/stats") {
    const u = await getUser(req) as any;
    if (!u || u.role !== "admin") return json({ error: "Forbidden" }, 403);
    let totalUsers = 0, totalScripts = 0, pendingUsers = 0;
    for await (const entry of kv.list({ prefix: ["users"] })) {
      totalUsers++;
      if ((entry.value as any).status === "pending") pendingUsers++;
    }
    for await (const _ of kv.list({ prefix: ["scripts"] })) totalScripts++;
    return json({ stats: { totalUsers, totalScripts, pendingUsers } });
  }

  if (p.startsWith("/api/")) return json({ error: "Not found" }, 404);

  if (p.includes(".")) return serveStatic(p);
  return serveStatic("/index.html");
}

Deno.serve({ port: Number(Deno.env.get("PORT")) || 8000 }, handler);
