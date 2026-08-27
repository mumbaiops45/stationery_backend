const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const addressRoutes = require("./routes/address.routes");
const categoryRoutes = require("./routes/category.routes");
const productRoutes = require("./routes/product.routes");
const variantRoutes = require("./routes/variant.routes");
const inventoryRoutes = require("./routes/inventory.routes");
const uploadRoutes = require("./routes/upload.routes");
const wishlistRoutes = require("./routes/wishlist.routes");
const cartRoutes = require("./routes/cart.routes");
const checkoutRoutes = require("./routes/checkout.routes");
const paymentRoutes = require("./routes/payment.routes");
const orderRoutes = require("./routes/order.routes");
const adminOrderRoutes = require("./routes/adminOrder.routes");
const adminUserRoutes = require("./routes/adminUser.routes");
const adminDashboardRoutes = require("./routes/adminDashboard.routes");
const adminPaymentRoutes = require("./routes/adminPayment.routes");
const reportRoutes = require("./routes/report.routes");
const errorHandler = require("./middleware/error.middleware");

const app = express();

// Render (and most PaaS hosts) terminate TLS at their proxy, so Express sees a
// plain HTTP connection. Without this, req.secure is false and Secure cookies
// / rate-limit client IPs behave as if the request were not over HTTPS.
app.set("trust proxy", 1);

// Comma-separated list in CLIENT_URL, e.g.
// CLIENT_URL=http://localhost:3000,https://mystore.vercel.app
const allowedOrigins = (
  process.env.CLIENT_URL ||
  "http://localhost:3000,http://localhost:5000,http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

console.log("CORS allowed origins:", allowedOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser clients (Postman, curl, server-to-server)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin.replace(/\/$/, ""))) {
        return callback(null, true);
      }

      // Do NOT throw. CORS is enforced by the browser, not the server:
      // omitting the headers makes the browser block it, while non-browser
      // clients (Postman, curl, mobile apps) keep working normally.
      console.warn(`CORS: origin not allowed -> ${origin}`);
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Category/product images arrive as base64 data URLs in the JSON body, and
// base64 inflates the payload by ~33%. The body-parser default of 100kb
// rejected anything above a ~75kb source image with "request entity too large".
const JSON_BODY_LIMIT =
  process.env.JSON_BODY_LIMIT || "10mb";

app.use(
  express.json({
    limit: JSON_BODY_LIMIT,

    // Razorpay signs the exact bytes it sent, so the webhook
    // needs the raw buffer. Capturing it here (rather than a
    // separate raw parser) keeps every other route untouched.
    verify: (req, res, buf) => {
      if (
        req.originalUrl.includes(
          "/webhook"
        )
      ) {
        req.rawBody = buf;
      }
    },
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: JSON_BODY_LIMIT,
  })
);

app.use(cookieParser());

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message:
      "Stationery Store API is running",
  });
});
app.use(
  "/api/auth",
  authRoutes
);
app.use(
  "/api/users",
  userRoutes
);
app.use(
  "/api/users/addresses",
  addressRoutes
);
app.use(
  "/api/categories",
  categoryRoutes
);

app.use(
  "/api/products",
  productRoutes
);
app.use(
  "/api",
  variantRoutes
);
app.use(
  "/api/admin/inventory",
  inventoryRoutes
);
app.use(
  "/api/uploads",
  uploadRoutes
);
app.use(
  "/api/wishlist",
  wishlistRoutes
);
app.use(
  "/api/cart",
  cartRoutes
);

app.use(
  "/api/checkout",
  checkoutRoutes
);
app.use(
  "/api/payment",
  paymentRoutes
);

app.use(
  "/api/orders",
  orderRoutes
);
app.use(
  "/api/admin/orders",
  adminOrderRoutes
);
app.use(
  "/api/admin/users",
  adminUserRoutes
);

app.use(
  "/api/admin/dashboard",
  adminDashboardRoutes
);

app.use(
  "/api/admin/payments",
  adminPaymentRoutes
);

app.use(
  "/api/admin/reports",
  reportRoutes
);
app.use(errorHandler);

module.exports = app;