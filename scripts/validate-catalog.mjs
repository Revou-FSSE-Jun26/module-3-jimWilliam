import { existsSync, readFileSync } from "node:fs";

const c = JSON.parse(readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8"));
const idr = (n) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const errors = [];

const catIds = new Set(c.categories.map((x) => x.category_id));
const prodIds = new Set(c.products.map((x) => x.product_id));
const userIds = new Set(c.users.map((x) => x.id));
const slugs = new Set(c.products.map((x) => x.slug));
const STATUSES = ["pending", "paid", "shipped", "delivered", "cancelled"];

if (slugs.size !== c.products.length) errors.push("duplicate slug");
if (prodIds.size !== c.products.length) errors.push("duplicate product_id");

for (const p of c.products) {
  if (!catIds.has(p.category_id)) errors.push(`product ${p.product_id}: unknown category ${p.category_id}`);
  if (p.price < 0) errors.push(`product ${p.product_id}: negative price`);
  if (p.stock_quantity < 0) errors.push(`product ${p.product_id}: negative stock`);
  if (!/^[a-z0-9-]+$/.test(p.slug)) errors.push(`product ${p.product_id}: bad slug ${p.slug}`);
  if (!Array.isArray(p.images) || p.images.length === 0 || p.images.length > 12) errors.push(`product ${p.product_id}: needs 1 to 12 images`);
  for (const img of p.images ?? []) {
    if (!existsSync(new URL(`../assets${img}`, import.meta.url))) errors.push(`product ${p.product_id}: missing ${img}`);
  }
}

let itemCount = 0;
for (const o of c.orders) {
  if (!userIds.has(o.user_id)) errors.push(`order ${o.order_id}: unknown user`);
  if (!STATUSES.includes(o.order_status)) errors.push(`order ${o.order_id}: bad status`);
  if (o.items.length === 0) errors.push(`order ${o.order_id}: empty items`);
  const seen = new Set();
  for (const i of o.items) {
    itemCount++;
    if (!prodIds.has(i.product_id)) errors.push(`order ${o.order_id}: unknown product ${i.product_id}`);
    if (seen.has(i.product_id)) errors.push(`order ${o.order_id}: duplicate product ${i.product_id}`);
    seen.add(i.product_id);
    const p = c.products.find((x) => x.product_id === i.product_id);
    if (p && p.price !== i.unit_price) errors.push(`order ${o.order_id}: unit_price ${i.unit_price} != product price ${p.price} for ${p.product_name}`);
  }
}

console.log(`categories ${c.categories.length} | products ${c.products.length} | users ${c.users.length} | orders ${c.orders.length} | order_items ${itemCount}`);
console.log(`admins: ${c.users.filter((u) => u.role === "admin").map((u) => u.email).join(", ")}`);
console.log(`inactive products: ${c.products.filter((p) => !p.is_active).map((p) => p.product_name).join(", ") || "none"}`);
console.log(`low stock (<10): ${c.products.filter((p) => p.stock_quantity < 10).map((p) => `${p.product_name} (${p.stock_quantity})`).join(", ")}`);
console.log("");
for (const o of c.orders) {
  const total = o.items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  console.log(`  order ${o.order_id}  ${o.order_status.padEnd(10)} ${o.items.length} items  ${idr(total)}`);
}
const revenue = c.orders.filter((o) => o.order_status !== "cancelled").reduce((s, o) => s + o.items.reduce((t, i) => t + i.quantity * i.unit_price, 0), 0);
console.log(`\nrevenue excl. cancelled: ${idr(revenue)}`);
console.log(`catalog value: ${idr(c.products.reduce((s, p) => s + p.price * p.stock_quantity, 0))}`);

if (errors.length) { console.error("\nFAILED:\n" + errors.map((e) => "  - " + e).join("\n")); process.exit(1); }
console.log("\nvalidation: OK");
