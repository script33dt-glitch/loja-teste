const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Não autenticado" });

  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) return res.status(401).json({ error: "Sessão inválida" });

  const { orderId } = req.body || {};
  if (!orderId) return res.status(400).json({ error: "orderId ausente" });

  const { data: order, error } = await admin
    .from("orders")
    .select("id,status,stripe_session_id,user_id")
    .eq("id", orderId)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!order || order.user_id !== userData.user.id) return res.status(404).json({ error: "Pedido não encontrado" });
  if (order.status !== "pendente") return res.status(200).json({ status: order.status });

  let paid = true;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey && order.stripe_session_id) {
    const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${order.stripe_session_id}`, {
      headers: { Authorization: `Bearer ${stripeKey}` },
    });
    const session = await stripeRes.json();
    paid = session.payment_status === "paid";
  }

  if (!paid) return res.status(200).json({ status: "pendente" });

  await admin.from("orders").update({ status: "pago" }).eq("id", orderId);
  return res.status(200).json({ status: "pago" });
};
