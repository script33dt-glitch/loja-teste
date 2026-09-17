import { supabase } from "./supabase-client.js";

// Isso é só conveniência de navegação (evita mostrar a tela por um instante).
// A proteção de verdade é o RLS no banco: mesmo que alguém pule esse redirect,
// toda leitura/escrita administrativa falha no Postgres sem a role "admin".
export async function requireAdmin() {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    window.location.href = "/auth.html?redirect=/admin/index.html";
    return null;
  }
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: sessionData.session.user.id,
    _role: "admin",
  });
  if (isAdmin !== true) {
    window.location.href = "/index.html";
    return null;
  }
  return sessionData.session;
}
