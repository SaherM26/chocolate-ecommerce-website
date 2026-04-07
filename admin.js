const adminStorageKey = "chocolateHouseAdminProducts";
const adminGrid = document.querySelector("#admin-grid");
const adminSearch = document.querySelector("#admin-search");
const exportPanel = document.querySelector("#admin-export");
const exportOutput = document.querySelector("#export-output");
let draftProducts = loadDraftProducts();
let adminSearchTerm = "";

function loadDraftProducts() {
  try {
    return JSON.parse(localStorage.getItem(adminStorageKey) || "null") || products.map((product) => ({ ...product }));
  } catch {
    return products.map((product) => ({ ...product }));
  }
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function renderAdminProducts() {
  const filteredProducts = draftProducts.filter((product) =>
    `${product.name} ${product.category} ${product.stock}`.toLowerCase().includes(adminSearchTerm.toLowerCase())
  );

  adminGrid.innerHTML = filteredProducts
    .map(
      (product) => `
        <article class="admin-card" data-id="${product.id}">
          <div class="admin-card-image" style="background-image: url('${product.image}')" aria-hidden="true"></div>
          <div class="admin-card-fields">
            <div class="form-row">
              <label>Name<input data-field="name" value="${product.name}" /></label>
              <label>Price<input data-field="price" type="number" min="0" value="${product.price}" /></label>
            </div>
            <label>Description<textarea data-field="description" rows="3">${product.description}</textarea></label>
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
              <label>Badge<input data-field="badge" value="${product.badge}" /></label>
              <label>Detail<input data-field="detail" value="${product.detail}" /></label>
            </div>
            <label>Image URL<input data-field="image" value="${product.image}" /></label>
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

function updateProduct(id, field, value) {
  const product = draftProducts.find((item) => item.id === id);
  if (!product) return;
  product[field] = field === "price" ? Number(value) : value;
}

function savePreview() {
  localStorage.setItem(adminStorageKey, JSON.stringify(draftProducts));
  alert("Preview saved. Open the shop in this browser to see these product changes.");
}

function buildProductsFile() {
  return `const products = ${JSON.stringify(draftProducts, null, 2)};\n\nconst customizationOptions = ${JSON.stringify(customizationOptions, null, 2)};\n\nconst deliveryAreas = ${JSON.stringify(deliveryAreas, null, 2)};\n\nconst festivalCollections = ${JSON.stringify(festivalCollections, null, 2)};\n`;
}

adminGrid.addEventListener("input", (event) => {
  const field = event.target.dataset.field;
  const card = event.target.closest("[data-id]");
  if (!field || !card) return;
  updateProduct(card.dataset.id, field, event.target.value);
});

adminGrid.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove]");
  if (!removeButton) return;
  draftProducts = draftProducts.filter((product) => product.id !== removeButton.dataset.remove);
  renderAdminProducts();
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

document.querySelector("#save-preview").addEventListener("click", savePreview);

document.querySelector("#reset-preview").addEventListener("click", () => {
  localStorage.removeItem(adminStorageKey);
  draftProducts = products.map((product) => ({ ...product }));
  renderAdminProducts();
  alert("Preview changes reset.");
});

document.querySelector("#export-products").addEventListener("click", () => {
  exportOutput.value = buildProductsFile();
  exportPanel.hidden = false;
  exportPanel.scrollIntoView({ behavior: "smooth", block: "start" });
});

document.querySelector("#copy-export").addEventListener("click", async () => {
  exportOutput.select();
  try {
    await navigator.clipboard.writeText(exportOutput.value);
    alert("products.js code copied.");
  } catch {
    alert("Copy was blocked by the browser. Select the export text and copy it manually.");
  }
});

renderAdminProducts();
