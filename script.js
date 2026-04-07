const currency = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});

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

const cart = new Map();
const cartStorageKey = "chocolateHouseCart";
const productGrid = document.querySelector("#product-grid");
const cartPanel = document.querySelector("#cart-panel");
const overlay = document.querySelector(".overlay");
const cartItems = document.querySelector("#cart-items");
const cartEmpty = document.querySelector("#cart-empty");
const cartCount = document.querySelector("#cart-count");
const cartTotal = document.querySelector("#cart-total");
const productSearch = document.querySelector("#product-search");
const collectionGrid = document.querySelector("#collection-grid");
let revealObserver;
let activeFilter = "all";
let searchTerm = "";

function formatPrice(price) {
  return `INR ${currency.format(price)}`;
}

function renderSiteSettings() {
  document.querySelector("#announcement").textContent = siteSettings.announcementText;
  document.querySelector("#offer-eyebrow").textContent = siteSettings.offerEyebrow;
  document.querySelector("#offer-title").textContent = siteSettings.offerTitle;
}

function isSoldOut(product) {
  return product.stock.toLowerCase() === "sold out";
}

function getCartItems() {
  return [...cart.entries()]
    .map(([id, quantity]) => {
      const product = products.find((entry) => entry.id === id);
      return product ? { ...product, quantity } : null;
    })
    .filter(Boolean);
}

function saveCart() {
  const savedItems = getCartItems().map(({ id, name, detail, price, image, quantity }) => ({
    id,
    name,
    detail,
    price,
    image,
    quantity,
  }));
  localStorage.setItem(cartStorageKey, JSON.stringify(savedItems));
}

function loadCart() {
  let savedItems = [];

  try {
    savedItems = JSON.parse(localStorage.getItem(cartStorageKey) || "[]");
  } catch {
    savedItems = [];
  }

  savedItems.forEach((item) => {
    if (products.some((product) => product.id === item.id)) {
      cart.set(item.id, (cart.get(item.id) || 0) + item.quantity);
    }
  });
  saveCart();
}

function renderProducts() {
  const visibleProducts = products.filter((product) => {
    const matchesFilter = activeFilter === "all" || product.category === activeFilter;
    const matchesSearch = `${product.name} ${product.description} ${product.detail}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  productGrid.innerHTML = visibleProducts
    .map(
      (product) => {
        const soldOut = isSoldOut(product);
        return `
        <article class="product-card ${soldOut ? "sold-out" : ""}">
          <div class="product-image" style="background-image: linear-gradient(rgba(43, 20, 14, 0.04), rgba(43, 20, 14, 0.20)), url('${product.image}')" role="img" aria-label="${product.name}">
            <span class="product-badge">${product.badge}</span>
          </div>
          <div class="product-body">
            <div class="product-meta-row">
              <span class="product-meta">${product.detail}</span>
              <span class="stock-label">${product.stock}</span>
            </div>
            <h3>${product.name}</h3>
            <p>${product.description}</p>
            <div class="price-row">
              <strong>${formatPrice(product.price)}</strong>
              <button class="button primary" type="button" data-add="${product.id}" ${soldOut ? "disabled" : ""}>
                ${soldOut ? "Sold out" : "Add to cart"}
              </button>
            </div>
          </div>
        </article>
      `;
      }
    )
    .join("");

  if (visibleProducts.length === 0) {
    productGrid.innerHTML = `<div class="empty-products">No chocolates found. Try another search or category.</div>`;
  }

  productGrid.classList.add("reveal-group");
  observeReveals();
}

function renderCollections() {
  collectionGrid.innerHTML = festivalCollections
    .map(
      (collection) => `
        <article class="collection-card">
          <span>Special order</span>
          <h3>${collection.title}</h3>
          <p>${collection.text}</p>
          <a href="#contact">Ask for this</a>
        </article>
      `
    )
    .join("");
}

function renderCart() {
  const items = getCartItems();

  cartItems.innerHTML = items
    .map(
      (item) => `
        <article class="cart-item">
          <div>
            <strong>${item.name}</strong>
            <p>${formatPrice(item.price)} each</p>
            <div class="qty-controls" aria-label="Quantity controls for ${item.name}">
              <button type="button" data-decrease="${item.id}">-</button>
              <span>${item.quantity}</span>
              <button type="button" data-increase="${item.id}">+</button>
            </div>
          </div>
          <strong>${formatPrice(item.price * item.quantity)}</strong>
        </article>
      `
    )
    .join("");

  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  cartCount.textContent = count;
  cartTotal.textContent = formatPrice(total);
  cartEmpty.classList.toggle("visible", items.length === 0);
}

function updateQuantity(key, change) {
  const nextQuantity = (cart.get(key) || 0) + change;

  if (nextQuantity <= 0) {
    cart.delete(key);
  } else {
    cart.set(key, nextQuantity);
  }

  saveCart();
  renderCart();
}

function toggleCart() {
  const isOpen = cartPanel.classList.toggle("open");
  overlay.classList.toggle("open", isOpen);
  cartPanel.setAttribute("aria-hidden", String(!isOpen));
}

function observeReveals() {
  const revealItems = document.querySelectorAll(".reveal:not(.is-visible), .reveal-group:not(.is-visible)");

  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.16 }
    );
  }

  revealItems.forEach((item) => revealObserver.observe(item));
}

document.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add]");
  const increaseButton = event.target.closest("[data-increase]");
  const decreaseButton = event.target.closest("[data-decrease]");
  const toggleButton = event.target.closest("[data-cart-toggle]");
  const scrollLink = event.target.closest('a[href^="#"]');
  const filterButton = event.target.closest("[data-filter]");
  const checkoutLink = event.target.closest("#checkout-link");

  if (checkoutLink && cart.size === 0) {
    event.preventDefault();
    alert("Please add at least one chocolate product to your cart.");
    return;
  }

  if (addButton) {
    const product = products.find((entry) => entry.id === addButton.dataset.add);
    if (!product || isSoldOut(product)) return;
    updateQuantity(addButton.dataset.add, 1);
    if (!cartPanel.classList.contains("open")) toggleCart();
  }

  if (increaseButton) updateQuantity(increaseButton.dataset.increase, 1);
  if (decreaseButton) updateQuantity(decreaseButton.dataset.decrease, -1);
  if (toggleButton) toggleCart();
  if (filterButton) {
    activeFilter = filterButton.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((button) => {
      button.classList.toggle("active", button === filterButton);
    });
    renderProducts();
  }
  if (scrollLink) {
    event.preventDefault();
    const target = document.querySelector(scrollLink.getAttribute("href"));
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

productSearch.addEventListener("input", (event) => {
  searchTerm = event.target.value;
  renderProducts();
});

document.querySelector(".contact-form").addEventListener("submit", (event) => {
  event.preventDefault();
  alert("Thank you. Chocolate House will contact you soon.");
});

loadCart();
renderSiteSettings();
renderCollections();
renderProducts();
renderCart();
observeReveals();
