// Função serverless (Vercel). Roda em Node, nunca no navegador — é aqui, e só
// aqui, que a service_role key e a chave secreta da Stripe podem ser usadas.
const { createClient } = require("@supabase/supabase-js");

const FREE_SHIPPING_THRESHOLD_CENTS = 29900;
const SHIPPING_CENTS = 2990;

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
  const userId = userData.user.id;

  const { items, customerName, customerEmail, shippingAddress, origin } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "Carrinho vazio" });
  if (!customerName?.trim() || !customerEmail?.trim() || !shippingAddress?.trim()) {
    return res.status(400).json({ error: "Preencha nome, e-mail e endereço" });
  }

  const ids = [...new Set(items.map((i) => i.productId))];
  const { data: products, error: prodError } = await admin
    .from("products")
    .select("id,name,price_cents,active")
    .in("id", ids);
  if (prodError) return res.status(500).json({ error: prodError.message });

  let lines;
  try {
    lines = items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product || !product.active) throw new Error("Produto indisponível no carrinho");
      const quantity = Math.max(1, Math.min(99, Math.floor(item.quantity)));
      return {
        product_id: product.id,
        product_name: product.name,
        variant: item.variant || null,
        unit_price_cents: product.price_cents,
        quantity,
      };
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const productsTotalCents = lines.reduce((s, l) => s + l.unit_price_cents * l.quantity, 0);
  const shippingCents = productsTotalCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : SHIPPING_CENTS;
  const totalCents = productsTotalCents + shippingCents;

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      user_id: userId,
      status: "pendente",
      total_cents: totalCents,
      customer_name: customerName.trim(),
      customer_email: customerEmail.trim(),
      shipping_address: shippingAddress.trim(),
    })
    .select("id")
    .single();
  if (orderError || !order) return res.status(500).json({ error: orderError?.message || "Falha ao criar pedido" });

  const { error: itemsError } = await admin
    .from("order_items")
    .insert(lines.map((l) => ({ ...l, order_id: order.id })));
  if (itemsError) return res.status(500).json({ error: itemsError.message });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const cleanOrigin = String(origin || "").replace(/\/$/, "");

  if (!stripeKey) {
    // Modo demonstração: sem chave de teste configurada, pagamento simulado.
    return res.status(200).json({ orderId: order.id, url: null, demo: true });
  }

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", `${cleanOrigin}/pedido.html?id=${order.id}&pago=1`);
  params.set("cancel_url", `${cleanOrigin}/checkout.html?cancelado=1`);
  params.set("customer_email", customerEmail.trim());
  params.set("client_reference_id", order.id);
  params.set("metadata[order_id]", order.id);
  lines.forEach((line, index) => {
    params.set(`line_items[${index}][quantity]`, String(line.quantity));
    params.set(`line_items[${index}][price_data][currency]`, "brl");
    params.set(`line_items[${index}][price_data][unit_amount]`, String(line.unit_price_cents));
    params.set(
      `line_items[${index}][price_data][product_data][name]`,
      line.variant ? `${line.product_name} — ${line.variant}` : line.product_name,
    );
  });
  if (shippingCents > 0) {
    const i = lines.length;
    params.set(`line_items[${i}][quantity]`, "1");
    params.set(`line_items[${i}][price_data][currency]`, "brl");
    params.set(`line_items[${i}][price_data][unit_amount]`, String(shippingCents));
    params.set(`line_items[${i}][price_data][product_data][name]`, "Frete");
  }

  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const session = await stripeRes.json();
  if (!stripeRes.ok || !session.url) {
    console.error("Stripe checkout error", session.error);
    return res.status(502).json({ error: "Não foi possível iniciar o pagamento. Verifique a chave de teste Stripe." });
  }

  await admin.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);

  return res.status(200).json({ orderId: order.id, url: session.url, demo: false });
};
