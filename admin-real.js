const adminStorageKey = "chocolateHouseAdminProducts";
const adminGrid = document.querySelector("#admin-grid");
const adminSearch = document.querySelector("#admin-search");
const exportPanel = document.querySelector("#admin-export");
const exportOutput = document.querySelector("#export-output");
const saveButton = document.querySelector("#save-preview");
const resetButton = document.querySelector("#reset-preview");
const modeNotice = document.querySelector("#admin-mode");
const deliveryAdminList = document.querySelector("#delivery-admin-list");
const ordersList = document.querySelector("#orders-list");
const serverMode = location.protocol.startsWith("http");
let store = {
  products,
  customizationOptions,
  deliveryAreas,
  siteSettings,
  festivalCollections,
};
let draftProducts = products.map((product) => ({ ...product }));
let draftDeliveryAreas = { ...deliveryAreas };
let draftSettings = { ...siteSettings };
let adminSearchTerm = "";

async function loadStore() {
  if (!serverMode) {
    try {
      draftProducts = JSON.parse(localStorage.getItem(adminStorageKey) || "null") || products.map((product) => ({ ...product }));
    } catch {
      draftProducts = products.map((product) => ({ ...product }));
    }
    showMode("Preview mode: open admin through the local server to save directly into products.js.");
    return;
  }

  const response = await fetch("/api/products");
  if (!response.ok) throw new Error("Could not load products from server");
  store = await response.json();
  draftProducts = store.products.map((product) => ({ ...product }));
  draftDeliveryAreas = { ...(store.deliveryAreas || deliveryAreas) };
  draftSettings = { ...(store.siteSettings || siteSettings) };
  showMode("Server mode: saving writes directly to products.js.");
}

function showMode(message) {
  if (!modeNotice) return;
  modeNotice.textContent = message;
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderAdminProducts() {
  const filteredProducts = draftProducts.filter((product) =>
    `${product.name} ${product.category} ${product.stock}`.toLowerCase().includes(adminSearchTerm.toLowerCase())
  );

  adminGrid.innerHTML = filteredProducts
    .map(
      (product) => `
        <article class="admin-card" data-id="${product.id}">
          <div class="admin-card-image" style="background-image: url('${escapeHtml(product.image)}')" aria-hidden="true"></div>
          <div class="admin-card-fields">
            <div class="form-row">
              <label>Name<input data-field="name" value="${escapeHtml(product.name)}" /></label>
              <label>Price<input data-field="price" type="number" min="0" value="${product.price}" /></label>
            </div>
            <label>Description<textarea data-field="description" rows="3">${escapeHtml(product.description)}</textarea></label>
            <div class="form-row">
              <label>Category
                <select data-field="category">
                  ${["gifts", "bars", "bakery", "snacks"].map((category) => `<option ${product.category === category ? "selected" : ""}>${category}</option>`).join("")}
                </select>
              </label>
              <label>Stock
                <select data-field="stock">
                  ${["Available today", "Limited stock", "Made on order", "Pre-order only", "Sold out"].map((stock) => `<option ${product.stock === stock ? "selected" : ""}>${stock}</option>`).join("")}
                </select>
              </label>
            </div>
            <div class="form-row">
              <label>Badge<input data-field="badge" value="${escapeHtml(product.badge)}" /></label>
              <label>Detail<input data-field="detail" value="${escapeHtml(product.detail)}" /></label>
            </div>
            <label>Image URL<input data-field="image" value="${escapeHtml(product.image)}" /></label>
            <label>Upload image<input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" data-upload-image="${product.id}" /></label>
            <button class="button secondary dark-secondary" type="button" data-remove="${product.id}">Remove</button>
          </div>
        </article>
      `
    )
    .join("");

  if (filteredProducts.length === 0) {
    adminGrid.innerHTML = `<div class="empty-products">No admin products found.</div>`;
  }
}

async function uploadImage(file) {
  if (!serverMode) throw new Error("Open admin through http://localhost:3000/admin.html to upload images.");
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const response = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, type: file.type, data }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Image upload failed");
  return result.path;
}

async function loadOrders() {
  if (!serverMode) {
    ordersList.innerHTML = `<div class="empty-products">Open admin through the local server to view orders.</div>`;
    return;
  }

  const response = await fetch("/api/orders");
  const result = await response.json();
  renderOrders(result.orders || []);
}

function renderOrders(orders) {
  if (orders.length === 0) {
    ordersList.innerHTML = `<div class="empty-products">No orders yet.</div>`;
    return;
  }

  ordersList.innerHTML = orders
    .map(
      (order) => `
        <article class="order-card" data-order-id="${escapeHtml(order.orderId)}">
          <div>
            <p class="eyebrow">${escapeHtml(order.orderId)}</p>
            <h3>${escapeHtml(order.customerName)}</h3>
            <p>${escapeHtml(order.phone)} | ${escapeHtml(order.city)} ${escapeHtml(order.pincode)}</p>
            <p>${escapeHtml(order.total)} | ${escapeHtml(order.paymentPreference)}</p>
            <p>${(order.items || []).map((item) => `${escapeHtml(item.name)} x ${item.quantity}`).join(", ")}</p>
          </div>
          <label>
            Status
            <select data-order-status="${escapeHtml(order.orderId)}">
              ${["New", "Confirmed", "Preparing", "Delivered", "Cancelled"].map((status) => `<option ${order.status === status ? "selected" : ""}>${status}</option>`).join("")}
            </select>
          </label>
        </article>
      `
    )
    .join("");
}

function renderSettings() {
  document.querySelector("#setting-whatsapp").value = draftSettings.whatsappNumber || "";
  document.querySelector("#setting-announcement").value = draftSettings.announcementText || "";
  document.querySelector("#setting-offer-eyebrow").value = draftSettings.offerEyebrow || "";
  document.querySelector("#setting-offer-title").value = draftSettings.offerTitle || "";
}

function renderDeliveryAreas() {
  deliveryAdminList.innerHTML = Object.entries(draftDeliveryAreas)
    .map(
      ([pincode, delivery]) => `
        <div class="delivery-admin-row" data-pincode="${pincode}">
          <label>Pincode<input data-delivery-field="pincode" value="${escapeHtml(pincode)}" /></label>
          <label>Area<input data-delivery-field="area" value="${escapeHtml(delivery.area)}" /></label>
          <label>Fee<input data-delivery-field="fee" type="number" min="0" value="${delivery.fee}" /></label>
          <button class="button secondary dark-secondary" type="button" data-remove-delivery="${pincode}">Remove</button>
        </div>
      `
    )
    .join("");
}

function updateProduct(id, field, value) {
  const product = draftProducts.find((item) => item.id === id);
  if (!product) return;
  product[field] = field === "price" ? Number(value) : value;
}

async function saveProducts() {
  if (!serverMode) {
    localStorage.setItem(adminStorageKey, JSON.stringify(draftProducts));
    alert("Preview saved. Open the shop in this browser to see these product changes.");
    return;
  }

  const response = await fetch("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...store,
      products: draftProducts,
      deliveryAreas: draftDeliveryAreas,
      siteSettings: draftSettings,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Could not save products");
  }

  alert("Products saved to products.js.");
}

function buildProductsFile() {
  return `const products = ${JSON.stringify(draftProducts, null, 2)};\n\nconst customizationOptions = ${JSON.stringify(
    store.customizationOptions,
    null,
    2
  )};\n\nconst deliveryAreas = ${JSON.stringify(draftDeliveryAreas, null, 2)};\n\nconst siteSettings = ${JSON.stringify(
    draftSettings,
    null,
    2
  )};\n\nconst festivalCollections = ${JSON.stringify(
    store.festivalCollections,
    null,
    2
  )};\n`;
}

adminGrid.addEventListener("input", (event) => {
  const field = event.target.dataset.field;
  const card = event.target.closest("[data-id]");
  if (!field || !card) return;
  updateProduct(card.dataset.id, field, event.target.value);
});

adminGrid.addEventListener("change", async (event) => {
  const uploadInput = event.target.closest("[data-upload-image]");
  if (!uploadInput || !uploadInput.files?.[0]) return;

  try {
    const imagePath = await uploadImage(uploadInput.files[0]);
    updateProduct(uploadInput.dataset.uploadImage, "image", imagePath);
    renderAdminProducts();
    alert("Image uploaded. Click Save products to make it permanent.");
  } catch (error) {
    alert(error.message);
  }
});

adminGrid.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove]");
  if (!removeButton) return;
  draftProducts = draftProducts.filter((product) => product.id !== removeButton.dataset.remove);
  renderAdminProducts();
});

document.querySelector("#setting-whatsapp").addEventListener("input", (event) => {
  draftSettings.whatsappNumber = event.target.value.trim();
});

document.querySelector("#setting-announcement").addEventListener("input", (event) => {
  draftSettings.announcementText = event.target.value;
});

document.querySelector("#setting-offer-eyebrow").addEventListener("input", (event) => {
  draftSettings.offerEyebrow = event.target.value;
});

document.querySelector("#setting-offer-title").addEventListener("input", (event) => {
  draftSettings.offerTitle = event.target.value;
});

deliveryAdminList.addEventListener("input", (event) => {
  const row = event.target.closest("[data-pincode]");
  const field = event.target.dataset.deliveryField;
  if (!row || !field) return;

  const originalPincode = row.dataset.pincode;
  const current = draftDeliveryAreas[originalPincode] || { area: "", fee: 0 };

  if (field === "pincode") {
    const nextPincode = event.target.value.trim();
    if (!nextPincode || nextPincode === originalPincode) return;
    delete draftDeliveryAreas[originalPincode];
    draftDeliveryAreas[nextPincode] = current;
    row.dataset.pincode = nextPincode;
    return;
  }

  draftDeliveryAreas[originalPincode] = {
    ...current,
    [field]: field === "fee" ? Number(event.target.value) : event.target.value,
  };
});

deliveryAdminList.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove-delivery]");
  if (!removeButton) return;
  delete draftDeliveryAreas[removeButton.dataset.removeDelivery];
  renderDeliveryAreas();
});

ordersList.addEventListener("change", async (event) => {
  const statusSelect = event.target.closest("[data-order-status]");
  if (!statusSelect) return;
  const response = await fetch("/api/orders", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: statusSelect.dataset.orderStatus, status: statusSelect.value }),
  });
  if (!response.ok) alert("Could not update order status.");
});

adminSearch.addEventListener("input", (event) => {
  adminSearchTerm = event.target.value;
  renderAdminProducts();
});

document.querySelector("#add-product").addEventListener("click", () => {
  const nextName = "New Chocolate Product";
  const nextId = `${slugify(nextName)}-${Date.now()}`;
  draftProducts.unshift({
    id: nextId,
    name: nextName,
    description: "Describe this homemade chocolate product.",
    category: "gifts",
    badge: "New",
    detail: "Box",
    stock: "Available today",
    price: 499,
    image: "assets/chocolate-box.svg",
  });
  renderAdminProducts();
});

document.querySelector("#add-delivery-area").addEventListener("click", () => {
  let pincode = "000000";
  let suffix = 1;
  while (draftDeliveryAreas[pincode]) {
    pincode = `00000${suffix}`.slice(-6);
    suffix += 1;
  }
  draftDeliveryAreas[pincode] = { area: "New delivery area", fee: 100 };
  renderDeliveryAreas();
});

saveButton.addEventListener("click", async () => {
  try {
    await saveProducts();
  } catch (error) {
    alert(error.message);
  }
});

resetButton.addEventListener("click", async () => {
  if (serverMode) {
    await loadStore();
    renderSettings();
    renderDeliveryAreas();
    renderAdminProducts();
    alert("Unsaved edits reset from products.js.");
    return;
  }

  localStorage.removeItem(adminStorageKey);
  draftProducts = products.map((product) => ({ ...product }));
  draftDeliveryAreas = { ...deliveryAreas };
  draftSettings = { ...siteSettings };
  renderSettings();
  renderDeliveryAreas();
  renderAdminProducts();
  alert("Preview changes reset.");
});

document.querySelector("#export-products").addEventListener("click", () => {
  exportOutput.value = buildProductsFile();
  exportPanel.hidden = false;
  exportPanel.scrollIntoView({ behavior: "smooth", block: "start" });
});

document.querySelector("#refresh-orders").addEventListener("click", loadOrders);

document.querySelector("#copy-export").addEventListener("click", async () => {
  exportOutput.select();
  try {
    await navigator.clipboard.writeText(exportOutput.value);
    alert("products.js code copied.");
  } catch {
    alert("Copy was blocked by the browser. Select the export text and copy it manually.");
  }
});

loadStore()
  .then(() => {
    renderSettings();
    renderDeliveryAreas();
    renderAdminProducts();
    loadOrders();
  })
  .catch((error) => {
    showMode(error.message);
    renderSettings();
    renderDeliveryAreas();
    renderAdminProducts();
    loadOrders();
  });
