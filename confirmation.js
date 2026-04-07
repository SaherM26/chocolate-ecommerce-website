const summary = document.querySelector("#confirmation-summary");

function loadLastOrder() {
  try {
    return JSON.parse(sessionStorage.getItem("chocolateHouseLastOrder") || "{}");
  } catch {
    return {};
  }
}

const order = loadLastOrder();
summary.innerHTML = `
  <div><span>Order ID</span><strong>${order.orderId || "Generated in WhatsApp"}</strong></div>
  <div><span>Name</span><strong>${order.customerName || "Chocolate House customer"}</strong></div>
  <div><span>Items</span><strong>${order.itemCount || "To be confirmed"}</strong></div>
  <div><span>Delivery</span><strong>${order.delivery || "To be confirmed"}</strong></div>
  <div><span>Total</span><strong>${order.total || "To be confirmed"}</strong></div>
`;
