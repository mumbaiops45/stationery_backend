const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const addressRoutes = require("./routes/address.routes");
const categoryRoutes = require("./routes/category.routes");
const productRoutes =  require("./routes/product.routes");
const variantRoutes =  require("./routes/variant.routes");
const inventoryRoutes = require("./routes/inventory.routes");
const wishlistRoutes =  require("./routes/wishlist.routes");
const cartRoutes =   require("./routes/cart.routes");
const checkoutRoutes = require("./routes/checkout.routes");
const paymentRoutes = require("./routes/payment.routes");
const orderRoutes =  require("./routes/order.routes");
const adminUserRoutes =
  require("./routes/adminUser.routes");
const errorHandler = require("./middleware/error.middleware");

const app = express();

app.use(
  cors({
    origin:
      process.env.CLIENT_URL ||
      "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

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
  "/api/admin/users",
  adminUserRoutes
);
app.use(errorHandler);

module.exports = app;