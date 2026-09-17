export function formatBRL(cents) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export const STATUS_LABEL = {
  pendente: "Pendente",
  pago: "Pago",
  enviado: "Enviado",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

export function showToast(message) {
  let el = document.getElementById("app-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "app-toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove("show"), 2500);
}

// --- Carrinho (localStorage, por navegador) ---
const CART_KEY = "casa-atelie-cart";

export function getCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  updateCartBadge();
}

export function addToCart({ productId, name, priceCents, image, variant, quantity }) {
  const items = getCart();
  const existing = items.find((i) => i.productId === productId && i.variant === (variant ?? null));
  if (existing) {
    existing.quantity += quantity;
  } else {
    items.push({ productId, name, priceCents, image, variant: variant ?? null, quantity });
  }
  saveCart(items);
}

export function setQuantity(productId, variant, quantity) {
  let items = getCart();
  if (quantity <= 0) {
    items = items.filter((i) => !(i.productId === productId && i.variant === variant));
  } else {
    const item = items.find((i) => i.productId === productId && i.variant === variant);
    if (item) item.quantity = quantity;
  }
  saveCart(items);
}

export function removeFromCart(productId, variant) {
  setQuantity(productId, variant, 0);
}

export function clearCart() {
  saveCart([]);
}

export function cartCount() {
  return getCart().reduce((s, i) => s + i.quantity, 0);
}

export function cartTotalCents() {
  return getCart().reduce((s, i) => s + i.priceCents * i.quantity, 0);
}

export function updateCartBadge() {
  const badge = document.querySelector(".cart-badge");
  if (!badge) return;
  const count = cartCount();
  badge.textContent = String(count);
  badge.style.display = count > 0 ? "inline-block" : "none";
}
