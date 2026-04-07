const http = require("http");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const rootDir = __dirname;
const productsFile = path.join(rootDir, "products.js");
const ordersFile = path.join(rootDir, "orders.json");
const assetsDir = path.join(rootDir, "assets");
const port = Number(process.env.PORT || 3000);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function readStore() {
  const source = fs.readFileSync(productsFile, "utf8");
  const sandbox = {};
  vm.runInNewContext(
    `${source}\nstore = { products, customizationOptions, deliveryAreas, siteSettings: typeof siteSettings === "undefined" ? {} : siteSettings, festivalCollections };`,
    sandbox
  );
  return sandbox.store;
}

function readOrders() {
  if (!fs.existsSync(ordersFile)) return [];
  return JSON.parse(fs.readFileSync(ordersFile, "utf8") || "[]");
}

function writeOrders(orders) {
  fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2), "utf8");
}

function sanitizeFileName(fileName) {
  return path.basename(fileName).replace(/[^a-zA-Z0-9._ -]/g, "").trim() || `upload-${Date.now()}.jpg`;
}

function validateProducts(products) {
  if (!Array.isArray(products)) return false;

  return products.every(
    (product) =>
      product &&
      typeof product.id === "string" &&
      typeof product.name === "string" &&
      typeof product.description === "string" &&
      typeof product.category === "string" &&
      typeof product.badge === "string" &&
      typeof product.detail === "string" &&
      typeof product.stock === "string" &&
      typeof product.image === "string" &&
      Number.isFinite(Number(product.price))
  );
}

function writeStore(store) {
  if (!validateProducts(store.products)) {
    throw new Error("Invalid product data");
  }

  const normalizedProducts = store.products.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    category: product.category,
    badge: product.badge,
    detail: product.detail,
    stock: product.stock,
    price: Number(product.price),
    image: product.image,
  }));

  const currentStore = readStore();
  const nextStore = {
    products: normalizedProducts,
    customizationOptions: store.customizationOptions || currentStore.customizationOptions,
    deliveryAreas: store.deliveryAreas || currentStore.deliveryAreas,
    siteSettings: store.siteSettings || currentStore.siteSettings,
    festivalCollections: store.festivalCollections || currentStore.festivalCollections,
  };

  const output = `const products = ${JSON.stringify(nextStore.products, null, 2)};\n\nconst customizationOptions = ${JSON.stringify(
    nextStore.customizationOptions,
    null,
    2
  )};\n\nconst deliveryAreas = ${JSON.stringify(nextStore.deliveryAreas, null, 2)};\n\nconst siteSettings = ${JSON.stringify(
    nextStore.siteSettings,
    null,
    2
  )};\n\nconst festivalCollections = ${JSON.stringify(
    nextStore.festivalCollections,
    null,
    2
  )};\n`;

  fs.writeFileSync(productsFile, output, "utf8");
}

function saveUploadedImage(payload) {
  const allowedTypes = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/svg+xml": ".svg",
    "image/webp": ".webp",
  };
  const extension = allowedTypes[payload.type];
  if (!extension) throw new Error("Only JPG, PNG, SVG, and WEBP images are allowed");
  if (!payload.data || !payload.data.includes(",")) throw new Error("Invalid image upload");

  const baseName = sanitizeFileName(payload.name || `product-${Date.now()}${extension}`);
  const fileName = path.extname(baseName) ? baseName : `${baseName}${extension}`;
  const filePath = path.join(assetsDir, fileName);
  const resolvedPath = path.resolve(filePath);

  if (!resolvedPath.startsWith(path.resolve(assetsDir))) {
    throw new Error("Invalid upload path");
  }

  const buffer = Buffer.from(payload.data.split(",")[1], "base64");
  if (buffer.length > 5_000_000) throw new Error("Image must be smaller than 5MB");
  fs.writeFileSync(resolvedPath, buffer);
  return `assets/${fileName}`;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        request.destroy();
        reject(new Error("Request body is too large"));
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function serveStatic(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = decodeURIComponent(requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname);
  const filePath = path.normalize(path.join(rootDir, requestedPath));

  if (!filePath.startsWith(rootDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
    response.end(content);
  });
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.url.startsWith("/api/products") && request.method === "GET") {
      sendJson(response, 200, readStore());
      return;
    }

    if (request.url.startsWith("/api/products") && request.method === "POST") {
      const body = await readBody(request);
      writeStore(JSON.parse(body));
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.url.startsWith("/api/upload") && request.method === "POST") {
      const body = await readBody(request);
      const imagePath = saveUploadedImage(JSON.parse(body));
      sendJson(response, 200, { ok: true, path: imagePath });
      return;
    }

    if (request.url.startsWith("/api/orders") && request.method === "GET") {
      sendJson(response, 200, { orders: readOrders() });
      return;
    }

    if (request.url.startsWith("/api/orders") && request.method === "POST") {
      const body = await readBody(request);
      const order = JSON.parse(body);
      const orders = readOrders();
      orders.unshift({ ...order, status: order.status || "New", createdAt: new Date().toISOString() });
      writeOrders(orders);
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.url.startsWith("/api/orders") && request.method === "PATCH") {
      const body = await readBody(request);
      const update = JSON.parse(body);
      const orders = readOrders().map((order) =>
        order.orderId === update.orderId ? { ...order, status: update.status || order.status } : order
      );
      writeOrders(orders);
      sendJson(response, 200, { ok: true });
      return;
    }

    serveStatic(request, response);
  } catch (error) {
    sendJson(response, 500, { ok: false, error: error.message });
  }
});

server.listen(port, () => {
  console.log(`Chocolate House is running at http://localhost:${port}`);
  console.log(`Admin panel: http://localhost:${port}/admin.html`);
});
