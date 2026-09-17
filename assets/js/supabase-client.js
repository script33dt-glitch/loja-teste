// Cliente Supabase compartilhado por todas as páginas.
// A chave abaixo é a "publishable key" — feita para ser pública (equivalente à
// "anon key"), protegida pelas políticas de RLS no banco, não por segredo.
// NUNCA coloque aqui a service_role key — essa sim é secreta e só pode viver
// nas funções serverless (pasta /api).
export const SUPABASE_URL = "https://vrrrzsqxhhgatawxbyfv.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_T11XB3j28Irthtpm5m94PQ_GKuaaWsF";

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function requireSession(redirectTo) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    const target = redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : "";
    window.location.href = `/auth.html${target}`;
    return null;
  }
  return data.session;
}
