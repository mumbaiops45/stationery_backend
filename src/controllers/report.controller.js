const mongoose = require("mongoose");

const Order = require("../models/Order");
const Payment = require("../models/Payment");
const Product = require("../models/Product");
const Category = require("../models/Category");
const User = require("../models/User");

// ======================================================
// ADMIN REPORT - OVERVIEW
// ======================================================

const getOverviewReport = async (
  req,
  res,
  next
) => {
  try {
    const {
      period = "30d",
    } = req.query;

    // --------------------------------------------------
    // PERIOD
    // --------------------------------------------------

    const allowedPeriods = [
      "7d",
      "30d",
      "90d",
      "1y",
    ];

    if (
      !allowedPeriods.includes(period)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid period. Use 7d, 30d, 90d or 1y",
      });
    }

    const now = new Date();

    const startDate = new Date(now);

    if (period === "7d") {
      startDate.setDate(
        startDate.getDate() - 7
      );
    }

    if (period === "30d") {
      startDate.setDate(
        startDate.getDate() - 30
      );
    }

    if (period === "90d") {
      startDate.setDate(
        startDate.getDate() - 90
      );
    }

    if (period === "1y") {
      startDate.setFullYear(
        startDate.getFullYear() - 1
      );
    }

    // --------------------------------------------------
    // BASIC COUNTS
    // --------------------------------------------------

    const [
      totalCustomers,
      totalProducts,
      totalCategories,
      totalOrders,
      deliveredOrders,
      cancelledOrders,
    ] = await Promise.all([
      User.countDocuments({
        role: "customer",
      }),

      Product.countDocuments(),

      Category.countDocuments(),

      Order.countDocuments({
        createdAt: {
          $gte: startDate,
          $lte: now,
        },
      }),

      Order.countDocuments({
        orderStatus: "delivered",
        createdAt: {
          $gte: startDate,
          $lte: now,
        },
      }),

      Order.countDocuments({
        orderStatus: "cancelled",
        createdAt: {
          $gte: startDate,
          $lte: now,
        },
      }),
    ]);

    // --------------------------------------------------
    // PAYMENT SUMMARY
    // --------------------------------------------------

    const paymentSummary =
      await Payment.aggregate([
        {
          $match: {
            createdAt: {
              $gte: startDate,
              $lte: now,
            },
          },
        },

        {
          $group: {
            _id: "$status",

            count: {
              $sum: 1,
            },

            amount: {
              $sum: "$amount",
            },
          },
        },
      ]);

    const paymentStats = {
      created: {
        count: 0,
        amount: 0,
      },

      authorized: {
        count: 0,
        amount: 0,
      },

      captured: {
        count: 0,
        amount: 0,
      },

      failed: {
        count: 0,
        amount: 0,
      },

      refunded: {
        count: 0,
        amount: 0,
      },
    };

    paymentSummary.forEach(
      (item) => {
        if (
          paymentStats[item._id]
        ) {
          paymentStats[
            item._id
          ] = {
            count: item.count,
            amount: item.amount,
          };
        }
      }
    );

    // --------------------------------------------------
    // REVENUE
    // --------------------------------------------------

    const revenueResult =
      await Order.aggregate([
        {
          $match: {
            createdAt: {
              $gte: startDate,
              $lte: now,
            },

            paymentStatus:
              "captured",

            orderStatus: {
              $ne: "cancelled",
            },
          },
        },

        {
          $group: {
            _id: null,

            revenue: {
              $sum: "$total",
            },

            subtotal: {
              $sum: "$subtotal",
            },

            shipping: {
              $sum: "$shipping",
            },
          },
        },
      ]);

    const revenue =
      revenueResult[0] || {
        revenue: 0,
        subtotal: 0,
        shipping: 0,
      };

    // --------------------------------------------------
    // DAILY SALES
    // --------------------------------------------------

    const dailySales =
      await Order.aggregate([
        {
          $match: {
            createdAt: {
              $gte: startDate,
              $lte: now,
            },

            paymentStatus:
              "captured",

            orderStatus: {
              $ne: "cancelled",
            },
          },
        },

        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
              },
            },

            orders: {
              $sum: 1,
            },

            revenue: {
              $sum: "$total",
            },
          },
        },

        {
          $sort: {
            _id: 1,
          },
        },
      ]);

    // --------------------------------------------------
    // TOP SELLING PRODUCTS
    // --------------------------------------------------

    const topProducts =
      await Order.aggregate([
        {
          $match: {
            createdAt: {
              $gte: startDate,
              $lte: now,
            },

            paymentStatus:
              "captured",

            orderStatus: {
              $ne: "cancelled",
            },
          },
        },

        {
          $unwind: "$items",
        },

        {
          $group: {
            _id: "$items.product",

            productName: {
              $first:
                "$items.productName",
            },

            quantity: {
              $sum:
                "$items.quantity",
            },

            revenue: {
              $sum:
                "$items.itemTotal",
            },
          },
        },

        {
          $sort: {
            quantity: -1,
          },
        },

        {
          $limit: 10,
        },
      ]);

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    return res.status(200).json({
      success: true,

      data: {
        period: {
          type: period,
          from: startDate,
          to: now,
        },

        summary: {
          totalCustomers,
          totalProducts,
          totalCategories,
          totalOrders,
          deliveredOrders,
          cancelledOrders,
        },

        revenue: {
          total:
            revenue.revenue || 0,

          subtotal:
            revenue.subtotal || 0,

          shipping:
            revenue.shipping || 0,
        },

        payments:
          paymentStats,

        dailySales,

        topProducts,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOverviewReport,
};