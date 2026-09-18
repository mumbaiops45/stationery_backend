// ======================================================
// SHIPROCKET INTEGRATION
//
// Pushes a paid Order to Shiprocket as an "Adhoc" order right
// after checkout finishes. Every order here is prepaid - this
// store never offers cash on delivery - so payment_method is
// always "Prepaid".
//
// Uses the platform's built-in fetch (Node 18+), no extra
// dependency needed for one small integration.
// ======================================================

const BASE = "https://apiv2.shiprocket.in/v1/external";

// Package defaults. Weights are kg, dimensions are cm, per
// Shiprocket's API. Adjust if the store starts shipping
// meaningfully different box sizes.
const DEFAULTS = {
  weightKg: 0.5,
  lengthCm: 20,
  breadthCm: 15,
  heightCm: 5,
};

// Cached bearer token - Shiprocket tokens live ~10 days.
// Refresh on 401 or when within 24h of the assumed expiry.
let _token = null;
let _tokenExpiresAt = 0;

async function shiprocketFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text.slice(0, 300) };
  }

  return { ok: res.ok, status: res.status, data };
}

async function getToken(force = false) {
  const now = Date.now();
  if (!force && _token && now < _tokenExpiresAt - 24 * 60 * 60 * 1000) {
    return _token;
  }

  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;
  if (!email || !password) {
    const err = new Error(
      "Shiprocket credentials are not configured on the server (set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD in .env)"
    );
    err.status = 500;
    throw err;
  }

  const { ok, status, data } = await shiprocketFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (!ok || !data?.token) {
    const err = new Error(
      `Shiprocket login failed (${status}): ${data?.message || "no token returned"}`
    );
    err.status = 502;
    throw err;
  }

  _token = data.token;
  // Shiprocket does not return an explicit expiry - assume 10 days.
  _tokenExpiresAt = now + 10 * 24 * 60 * 60 * 1000;
  return _token;
}

function splitName(full) {
  const s = String(full || "").trim();
  if (!s) return { first: "Customer", last: "." };
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "." };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

// Strips everything but digits so "+91 98765-43210" still coerces to a
// usable 10-digit number. Shiprocket rejects the request outright if
// this ends up the wrong length, which the caller validates for.
function digitsOnly(v) {
  return String(v ?? "").replace(/\D/g, "");
}

// Builds the Shiprocket "Create Adhoc Order" payload from our Order
// document. Field names follow Shiprocket's docs exactly.
function buildPayload(order) {
  const addr = order.shippingAddress || {};
  const { first, last } = splitName(addr.name);
  const items = Array.isArray(order.items) ? order.items : [];

  const pincodeNum = Number(digitsOnly(addr.postalCode));
  const phoneDigits = digitsOnly(addr.phone).slice(-10);

  return {
    order_id: order.orderNumber,
    order_date: new Date(order.createdAt || Date.now())
      .toISOString()
      .slice(0, 19)
      .replace("T", " "),
    pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION || "Primary",
    channel_id: "",
    comment: `Storefront order ${order.orderNumber}`,
    billing_customer_name: first,
    billing_last_name: last,
    billing_address: addr.addressLine1 || "",
    billing_address_2: addr.addressLine2 || "",
    billing_city: addr.city || "",
    billing_pincode: pincodeNum,
    billing_state: addr.state || "",
    billing_country: addr.country || "India",
    billing_email: "",
    billing_phone: phoneDigits,
    shipping_is_billing: true,
    order_items: items.map((it) => ({
      name: it.productName || it.variantName || "Item",
      sku: String(it.product || it.variant || it.productName || "SKU"),
      units: Number(it.quantity) || 1,
      selling_price: Number(it.price) || 0,
    })),
    // No cash on delivery anywhere in this store - every order that
    // reaches here has already been captured by Razorpay.
    payment_method: "Prepaid",
    shipping_charges: Number(order.shipping) || 0,
    total_discount: 0,
    sub_total: Number(order.subtotal) || 0,
    length: DEFAULTS.lengthCm,
    breadth: DEFAULTS.breadthCm,
    height: DEFAULTS.heightCm,
    weight: DEFAULTS.weightKg,
  };
}

// Creates a Shiprocket adhoc order for a paid Order document.
// Returns { shiprocketOrderId, shipmentId, awbCode, courierName } on
// success. Throws on failure - the caller decides how to record that.
async function createShiprocketOrder(order) {
  const payload = buildPayload(order);

  // Validate up-front so a bad address fails fast with a message that
  // names the field, instead of Shiprocket's generic 422.
  const errs = [];
  if (!/^\d{6}$/.test(String(payload.billing_pincode))) {
    errs.push(
      `billing_pincode "${payload.billing_pincode}" (raw="${order.shippingAddress?.postalCode}") is not 6 digits`
    );
  }
  if (!/^\d{10}$/.test(String(payload.billing_phone))) {
    errs.push(
      `billing_phone "${payload.billing_phone}" (raw="${order.shippingAddress?.phone}") is not 10 digits`
    );
  }
  if (!payload.billing_address) errs.push("billing_address is empty");
  if (!payload.billing_city) errs.push("billing_city is empty");
  if (!payload.billing_state) errs.push("billing_state is empty");
  if (!payload.order_items?.length) errs.push("order_items is empty");
  if (errs.length) {
    const err = new Error(`Shiprocket payload invalid: ${errs.join("; ")}`);
    err.status = 400;
    throw err;
  }

  console.log(
    "[shiprocket] createOrder",
    order.orderNumber,
    `pincode=${payload.billing_pincode}`,
    `city=${payload.billing_city}`,
    `state=${payload.billing_state}`,
    `items=${payload.order_items.length}`,
    `total=${payload.sub_total}`
  );

  const send = async (bearer) => {
    const { ok, status, data } = await shiprocketFetch(
      "/orders/create/adhoc",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${bearer}` },
        body: JSON.stringify(payload),
      }
    );

    console.log(
      "[shiprocket] response for",
      order.orderNumber,
      status,
      JSON.stringify(data).slice(0, 500)
    );

    return { ok, status, data };
  };

  const asResult = (data) => ({
    shiprocketOrderId: data?.order_id ? String(data.order_id) : "",
    shipmentId: data?.shipment_id ? String(data.shipment_id) : "",
    awbCode: data?.awb_code || "",
    courierName: data?.courier_name || "",
  });

  const raiseIfEmpty = (status, data) => {
    // Shiprocket sometimes answers 200 with { status: 1, message: 'Wrong
    // Pickup location...' } instead of an actual order - that is a
    // silent failure and must be treated as one.
    if (data?.order_id || data?.shipment_id) return;
    const detail = data?.message || JSON.stringify(data || {}).slice(0, 300);
    const err = new Error(
      `Shiprocket ${status} but returned no order_id/shipment_id: ${detail}`
    );
    err.status = 502;
    throw err;
  };

  let token = await getToken();
  let { ok, status, data } = await send(token);

  // Retry once on 401 in case the cached token expired mid-flight.
  if (!ok && status === 401) {
    token = await getToken(true);
    ({ ok, status, data } = await send(token));
  }

  if (!ok) {
    const detail = data?.message || JSON.stringify(data || {}).slice(0, 300);
    const err = new Error(`Shiprocket ${status}: ${detail}`);
    err.status = status || 500;
    throw err;
  }

  raiseIfEmpty(status, data);
  return asResult(data);
}

module.exports = { createShiprocketOrder, getToken };
