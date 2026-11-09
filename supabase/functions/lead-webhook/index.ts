// Recebe leads do formulário do site.
// POST com "Authorization: Bearer <chave de API do CRM>" e JSON (ou formulário).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SERVICOS = ["Gestão de tráfego", "Social media", "SEO", "Site / Landing page", "Branding", "Marketing completo"];
const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

function sameKey(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Use o método POST." }, 405);

  const sent = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!sent) return json({ error: "Chave de API ausente." }, 401);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data: cfg, error: cfgErr } = await db.from("settings").select("api_key").eq("id", 1).single();
  if (cfgErr || !cfg) return json({ error: "CRM não configurado." }, 500);
  if (!sameKey(sent, cfg.api_key)) return json({ error: "Chave de API inválida." }, 401);

  let body: Record<string, unknown> = {};
  try {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) body = await req.json();
    else body = Object.fromEntries((await req.formData()).entries());
  } catch {
    return json({ error: "Corpo da requisição inválido." }, 400);
  }

  const nome = clip(body.nome, 120);
  const email = clip(body.email, 160);
  const telefone = clip(body.telefone, 40);
  if (!nome) return json({ error: "Informe o nome." }, 422);
  if (!email && !telefone) return json({ error: "Informe e-mail ou telefone." }, 422);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "E-mail inválido." }, 422);

  // Rodízio entre a equipe
  const { data: team } = await db.from("team").select("name").order("created_at", { ascending: true });
  const { data: n } = await db.rpc("take_rr");
  const resp = team && team.length ? team[(Number(n) || 0) % team.length].name : "";

  const servico = SERVICOS.includes(String(body.servico)) ? String(body.servico) : SERVICOS[0];
  const now = new Date().toISOString();
  const mensagem = clip(body.mensagem, 2000);

  const { data: lead, error } = await db.from("leads").insert({
    nome,
    empresa: clip(body.empresa, 120),
    email,
    telefone,
    origem: "Site – formulário",
    servico,
    etapa: "novo",
    resp,
    utm: {
      source: clip(body.utm_source ?? body.source, 80),
      medium: clip(body.utm_medium ?? body.medium, 80),
      campaign: clip(body.utm_campaign ?? body.campaign, 120),
    },
    notas: mensagem ? [{ t: now, txt: mensagem, autor: "Formulário do site" }] : [],
    hist: [{ t: now, txt: "Lead recebido do site (webhook) e atribuído a " + (resp || "ninguém") }],
  }).select("id").single();
  if (error || !lead) return json({ error: "Não foi possível salvar o lead." }, 500);

  if (resp) {
    await db.from("tasks").insert({
      lead_id: lead.id,
      titulo: "Primeiro contato com o lead (até 15 min)",
      venc: now.slice(0, 10),
      resp,
    });
  }
  return json({ ok: true, id: lead.id }, 201);
});
