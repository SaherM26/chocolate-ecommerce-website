const cartStorageKey = "chocolateHouseCart";
const orderCounterKey = "chocolateHouseOrderCounter";
const whatsappNumber = siteSettings.whatsappNumber;
let adminProducts = null;
if (!location.protocol.startsWith("http")) {
  try {
    adminProducts = JSON.parse(localStorage.getItem("chocolateHouseAdminProducts") || "null");
  } catch {
    adminProducts = null;
  }
}
if (adminProducts) {
  products.splice(0, products.length, ...adminProducts);
}

const currency = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});

const checkoutItems = document.querySelector("#checkout-items");
const checkoutEmpty = document.querySelector("#checkout-empty");
const checkoutSubtotal = document.querySelector("#checkout-subtotal");
const checkoutTotal = document.querySelector("#checkout-total");
const checkoutDelivery = document.querySelector("#checkout-delivery");
const checkoutForm = document.querySelector("#checkout-form");
const pincodeInput = document.querySelector("#pincode");
const deliveryCheck = document.querySelector("#delivery-check");
let deliveryFee = 0;
let deliveryArea = null;

function formatPrice(price) {
  return `INR ${currency.format(price)}`;
}

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(cartStorageKey) || "[]");
  } catch {
    return [];
  }
}

function renderCheckout() {
  const items = loadCart();

  checkoutItems.innerHTML = items
    .map(
      (item) => `
        <article class="summary-item">
          <div class="summary-thumb" style="background-image: url('${item.image}')" aria-hidden="true"></div>
          <div>
            <strong>${item.name}</strong>
            <span>${item.detail}</span>
            <span>${item.quantity} x ${formatPrice(item.price)}</span>
          </div>
          <strong>${formatPrice(item.price * item.quantity)}</strong>
        </article>
      `
    )
    .join("");

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  checkoutSubtotal.textContent = formatPrice(subtotal);
  checkoutTotal.textContent = formatPrice(subtotal + deliveryFee);
  checkoutEmpty.classList.toggle("visible", items.length === 0);
  checkoutForm.querySelector("button[type='submit']").disabled = items.length === 0;
}

function valueOrDefault(value, fallback = "Not provided") {
  return value && String(value).trim() ? String(value).trim() : fallback;
}

function generateOrderId() {
  const today = new Date();
  const datePart = today.toISOString().slice(0, 10).replaceAll("-", "");
  const nextCounter = Number(localStorage.getItem(orderCounterKey) || "0") + 1;
  localStorage.setItem(orderCounterKey, String(nextCounter));
  return `CH-${datePart}-${String(nextCounter).padStart(3, "0")}`;
}

function updateDeliveryCheck() {
  const pincode = pincodeInput.value.trim();
  const subtotal = loadCart().reduce((sum, item) => sum + item.price * item.quantity, 0);
  const match = deliveryAreas[pincode];

  if (!pincode) {
    deliveryFee = 0;
    deliveryArea = null;
    checkoutDelivery.textContent = "Enter pincode";
    deliveryCheck.textContent = "Enter pincode to check delivery availability.";
    deliveryCheck.className = "delivery-check";
    renderCheckout();
    return;
  }

  if (!match) {
    deliveryFee = 0;
    deliveryArea = null;
    checkoutDelivery.textContent = "Not available";
    deliveryCheck.textContent = "Delivery is not listed for this pincode. You can still send the order on WhatsApp to ask.";
    deliveryCheck.className = "delivery-check unavailable";
    renderCheckout();
    return;
  }

  deliveryArea = match.area;
  deliveryFee = subtotal >= 1499 ? 0 : match.fee;
  checkoutDelivery.textContent = deliveryFee === 0 ? "Free" : formatPrice(deliveryFee);
  deliveryCheck.textContent =
    deliveryFee === 0
      ? `Delivery available in ${match.area}. Free delivery applied.`
      : `Delivery available in ${match.area}. Delivery charge: ${formatPrice(deliveryFee)}.`;
  deliveryCheck.className = "delivery-check available";
  renderCheckout();
}

function buildWhatsAppMessage(items, formData, orderId) {
  const productLines = items
    .map(
      (item, index) =>
        `${index + 1}. ${item.name} (${item.detail}) - Qty: ${item.quantity} - ${formatPrice(item.price * item.quantity)}`
    )
    .join("\n");

  return [
    "Hello Chocolate House, I want to place an order.",
    `Order ID: ${orderId}`,
    "",
    "Order items:",
    productLines,
    "",
    `Order total: ${checkoutTotal.textContent}`,
    `Delivery: ${deliveryArea ? `${deliveryArea}, ${deliveryFee === 0 ? "Free" : formatPrice(deliveryFee)}` : "To be confirmed by call"}`,
    "",
    "Customer details:",
    `Name: ${valueOrDefault(formData.get("customerName"))}`,
    `Phone: ${valueOrDefault(formData.get("phone"))}`,
    `Email: ${valueOrDefault(formData.get("email"))}`,
    "",
    "Delivery details:",
    `Address: ${valueOrDefault(formData.get("address"))}`,
    `City: ${valueOrDefault(formData.get("city"))}`,
    `Pincode: ${valueOrDefault(formData.get("pincode"))}`,
    `Preferred date: ${valueOrDefault(formData.get("deliveryDate"))}`,
    `Preferred time: ${valueOrDefault(formData.get("deliveryTime"), "Any time")}`,
    "",
    "Payment and notes:",
    `Chocolate preference: ${valueOrDefault(formData.get("chocolatePreference"))}`,
    `Gift packing: ${valueOrDefault(formData.get("giftPacking"))}`,
    `Payment preference: ${valueOrDefault(formData.get("paymentPreference"))}`,
    `Gift note / instructions: ${valueOrDefault(formData.get("orderNotes"))}`,
  ].join("\n");
}

function buildOrderRecord(items, formData, orderId) {
  return {
    orderId,
    customerName: valueOrDefault(formData.get("customerName")),
    phone: valueOrDefault(formData.get("phone")),
    email: valueOrDefault(formData.get("email")),
    address: valueOrDefault(formData.get("address")),
    city: valueOrDefault(formData.get("city")),
    pincode: valueOrDefault(formData.get("pincode")),
    deliveryDate: valueOrDefault(formData.get("deliveryDate")),
    deliveryTime: valueOrDefault(formData.get("deliveryTime"), "Any time"),
    paymentPreference: valueOrDefault(formData.get("paymentPreference")),
    chocolatePreference: valueOrDefault(formData.get("chocolatePreference")),
    giftPacking: valueOrDefault(formData.get("giftPacking")),
    orderNotes: valueOrDefault(formData.get("orderNotes")),
    delivery: deliveryArea || "To be confirmed",
    deliveryFee,
    total: checkoutTotal.textContent,
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      detail: item.detail,
      quantity: item.quantity,
      price: item.price,
    })),
  };
}

async function saveOrder(order) {
  if (!location.protocol.startsWith("http")) return;
  await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(order),
  });
}

function showCheckoutContent() {
  document.querySelectorAll(".reveal").forEach((item) => item.classList.add("is-visible"));
}

checkoutForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const items = loadCart();

  if (items.length === 0) {
    alert("Please add at least one chocolate product before checkout.");
    return;
  }

  if (!checkoutForm.checkValidity()) {
    checkoutForm.reportValidity();
    return;
  }

  const formData = new FormData(checkoutForm);
  const orderId = generateOrderId();
  const orderRecord = buildOrderRecord(items, formData, orderId);
  const message = buildWhatsAppMessage(items, formData, orderId);
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
  sessionStorage.setItem(
    "chocolateHouseLastOrder",
    JSON.stringify({
      orderId,
      total: checkoutTotal.textContent,
      customerName: valueOrDefault(formData.get("customerName")),
      delivery: deliveryArea || "To be confirmed",
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    })
  );
  saveOrder(orderRecord);
  localStorage.removeItem(cartStorageKey);
  window.open(whatsappUrl, "_blank", "noopener");
  window.location.href = "order-confirmation.html";
});

renderCheckout();
showCheckoutContent();
pincodeInput.addEventListener("input", updateDeliveryCheck);
