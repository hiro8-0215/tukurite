import {sql} from '../_shared/runtime.ts';
import {requestLimit,SecurityError} from '../_shared/account-security.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.111.0';

const AUTH_EMAIL_DOMAIN = 'users.tsukurite.app';
const reservedLoginIds = new Set(['admin', 'administrator', 'api', 'help', 'owner', 'root', 'staff', 'support']);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function namedProjectKey(environmentName: 'SUPABASE_SECRET_KEYS') {
  try {
    const keys = JSON.parse(Deno.env.get(environmentName) ?? '{}') as Record<string, unknown>;
    return typeof keys.default === 'string' ? keys.default : '';
  } catch {
    return '';
  }
}

function normalizeLoginId(value: string) {
  return value.trim().toLowerCase();
}

function validLoginId(value: string) {
  return value.length >= 4
    && value.length <= 24
    && /^[a-z0-9][a-z0-9._-]*[a-z0-9]$/.test(value)
    && !reservedLoginIds.has(value);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try{await requestLimit(sql,request,'register',30,5);}catch(e){return json({error:e instanceof SecurityError?'rate_limited':'service_unavailable'},e instanceof SecurityError?e.status:503);}
  if(Number(request.headers.get('content-length')||0)>2000)return json({error:'input_too_large'},413);
  let body: { loginId?: unknown; password?: unknown };
  try {
    const raw=await request.text();if(raw.length>2000)return json({error:'input_too_large'},413);body=JSON.parse(raw);
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'invalid_json'},400);
  const loginId = normalizeLoginId(typeof body.loginId === 'string' ? body.loginId : '');
  const password = typeof body.password === 'string' ? body.password : '';
  if (!validLoginId(loginId)) return json({ error: 'invalid_login_id' }, 422);
  if (password.length < 8 || password.length > 72) return json({ error: 'weak_password' }, 422);

  const secretKey = namedProjectKey('SUPABASE_SECRET_KEYS');
  if (!secretKey) return json({ error: 'server_not_configured' }, 503);
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await admin.auth.admin.createUser({
    email: `${loginId}@${AUTH_EMAIL_DOMAIN}`,
    password,
    email_confirm: true,
    user_metadata: { login_id: loginId, auth_method: 'login_id' },
  });
  if (error) {
    const code = String(error.code ?? '').toLowerCase();
    const message = error.message.toLowerCase();
    if (code === 'email_exists' || code === 'user_already_exists' || message.includes('already registered')) {
      return json({ error: 'login_id_taken' }, 409);
    }
    if (code === 'weak_password') return json({ error: 'weak_password' }, 422);
    return json({ error: 'registration_failed' }, 422);
  }

  return json({ created: true }, 201);
});
