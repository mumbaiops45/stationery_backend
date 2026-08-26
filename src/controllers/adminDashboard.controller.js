const User = require("../models/User");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const Order = require("../models/Order");

// ======================================================
// ADMIN DASHBOARD
// ======================================================

const getDashboard = async (
  req,
  res,
  next
) => {
  try {
    // ==================================================
    // USERS
    // ==================================================

    const [
      totalUsers,
      totalCustomers,
      totalAdmins,
      activeUsers,
      inactiveUsers,
    ] = await Promise.all([
      User.countDocuments(),

      User.countDocuments({
        role: "customer",
      }),

      User.countDocuments({
        role: "admin",
      }),

      User.countDocuments({
        isActive: true,
      }),

      User.countDocuments({
        isActive: false,
      }),
    ]);

    // ==================================================
    // PRODUCTS
    // ==================================================

    const [
      totalProducts,
      activeProducts,
      inactiveProducts,
      outOfStockProducts,
      lowStockProducts,
    ] = await Promise.all([
      Product.countDocuments(),

      Product.countDocuments({
        isActive: true,
      }),

      Product.countDocuments({
        isActive: false,
      }),

      Product.countDocuments({
        stock: 0,
      }),

      Product.countDocuments({
        stock: {
          $gt: 0,
          $lte: 10,
        },
      }),
    ]);

    // ==================================================
    // VARIANTS
    // ==================================================

    const [
      totalVariants,
      outOfStockVariants,
      lowStockVariants,
    ] = await Promise.all([
      ProductVariant.countDocuments(),

      ProductVariant.countDocuments({
        stock: 0,
      }),

      ProductVariant.countDocuments({
        stock: {
          $gt: 0,
          $lte: 10,
        },
      }),
    ]);

    // ==================================================
    // ORDERS
    // ==================================================

    const [
      totalOrders,
      confirmedOrders,
      processingOrders,
      shippedOrders,
      outForDeliveryOrders,
      deliveredOrders,
      cancelledOrders,
    ] = await Promise.all([
      Order.countDocuments(),

      Order.countDocuments({
        orderStatus: "confirmed",
      }),

      Order.countDocuments({
        orderStatus: "processing",
      }),

      Order.countDocuments({
        orderStatus: "shipped",
      }),

      Order.countDocuments({
        orderStatus:
          "out_for_delivery",
      }),

      Order.countDocuments({
        orderStatus: "delivered",
      }),

      Order.countDocuments({
        orderStatus: "cancelled",
      }),
    ]);

    // ==================================================
    // PAYMENTS
    // ==================================================

    const [
      capturedPayments,
      failedPayments,
      refundedPayments,
    ] = await Promise.all([
      Order.countDocuments({
        paymentStatus: "captured",
      }),

      Order.countDocuments({
        paymentStatus: "failed",
      }),

      Order.countDocuments({
        paymentStatus: "refunded",
      }),
    ]);

    // ==================================================
    // TOTAL SALES
    // ==================================================

    const salesResult =
      await Order.aggregate([
        {
          $match: {
            paymentStatus: "captured",

            orderStatus: {
              $ne: "cancelled",
            },
          },
        },

        {
          $group: {
            _id: null,

            totalSales: {
              $sum: "$total",
            },
          },
        },
      ]);

    const totalSales =
      salesResult.length > 0
        ? salesResult[0].totalSales
        : 0;

    // ==================================================
    // RECENT ORDERS
    // ==================================================

    const recentOrders =
      await Order.find()
        .sort({
          createdAt: -1,
        })
        .limit(5)
        .populate(
          "user",
          "name email"
        )
        .select(
          "orderNumber user total orderStatus paymentStatus createdAt"
        )
        .lean();

    // ==================================================
    // RESPONSE
    // ==================================================

    return res.status(200).json({
      success: true,

      data: {
        users: {
          total: totalUsers,
          customers:
            totalCustomers,
          admins: totalAdmins,
          active: activeUsers,
          inactive:
            inactiveUsers,
        },

        products: {
          total: totalProducts,
          active:
            activeProducts,
          inactive:
            inactiveProducts,

          lowStock:
            lowStockProducts,

          outOfStock:
            outOfStockProducts,
        },

        variants: {
          total: totalVariants,

          lowStock:
            lowStockVariants,

          outOfStock:
            outOfStockVariants,
        },

        orders: {
          total: totalOrders,

          confirmed:
            confirmedOrders,

          processing:
            processingOrders,

          shipped:
            shippedOrders,

          outForDelivery:
            outForDeliveryOrders,

          delivered:
            deliveredOrders,

          cancelled:
            cancelledOrders,
        },

        payments: {
          captured:
            capturedPayments,

          failed:
            failedPayments,

          refunded:
            refundedPayments,
        },

        sales: {
          total:
            totalSales,
          currency: "INR",
        },

        recentOrders,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboard,
};