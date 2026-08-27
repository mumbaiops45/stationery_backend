const mongoose = require("mongoose");

const Order = require("../models/Order");
const {
  ORDER_STATUSES,
  ALLOWED_TRANSITIONS,
  CUSTOMER_CANCELLABLE,
  canTransition,
  restoreOrderStock,
} = require("../utils/orderStock");

// ======================================================
// GET MY ORDERS
// ======================================================

const getMyOrders = async (
  req,
  res,
  next
) => {
  try {
    const orders =
      await Order.find({
        user: req.user.userId,
      })
        .sort({
          createdAt: -1,
        })
        .lean();

    return res.status(200).json({
      success: true,
      data: {
        orders,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// GET MY ORDER
// ======================================================

const getMyOrder = async (
  req,
  res,
  next
) => {
  try {
    const { id } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(id)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order =
      await Order.findOne({
        _id: id,
        user: req.user.userId,
      }).lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        order,
      },
    });
  } catch (error) {
    next(error);
  }
};


// ======================================================
// GET ALL ORDERS - ADMIN
// Search + Filters + Sort + Pagination
// ======================================================

const getAdminOrders = async (
  req,
  res,
  next
) => {
  try {
    const {
      search = "",
      orderStatus = "all",
      paymentStatus = "all",
      sort = "newest",
      page = 1,
      limit = 20,
    } = req.query;

    // --------------------------------------------------
    // PAGINATION
    // --------------------------------------------------

    const currentPage = Math.max(
      Number(page) || 1,
      1
    );

    const perPage = Math.min(
      Math.max(Number(limit) || 20, 1),
      100
    );

    const skip =
      (currentPage - 1) * perPage;

    // --------------------------------------------------
    // FILTER
    // --------------------------------------------------

    const filter = {};

    // Order status
    if (
      orderStatus !== "all"
    ) {
      filter.orderStatus =
        orderStatus;
    }

    // Payment status
    if (
      paymentStatus !== "all"
    ) {
      filter.paymentStatus =
        paymentStatus;
    }

    // Search by order number
    if (search.trim()) {
      filter.orderNumber = {
        $regex: search.trim(),
        $options: "i",
      };
    }

    // --------------------------------------------------
    // SORT
    // --------------------------------------------------

    const sortOption =
      sort === "oldest"
        ? { createdAt: 1 }
        : { createdAt: -1 };

    // --------------------------------------------------
    // GET ORDERS
    // --------------------------------------------------

    const [
      orders,
      totalOrders,
    ] = await Promise.all([
      Order.find(filter)
        .populate(
          "user",
          "name email phone"
        )
        .populate(
          "payment"
        )
        .sort(sortOption)
        .skip(skip)
        .limit(perPage)
        .lean(),

      Order.countDocuments(
        filter
      ),
    ]);

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    return res.status(200).json({
      success: true,

      data: {
        orders,

        pagination: {
          page: currentPage,
          limit: perPage,
          totalOrders,
          totalPages: Math.ceil(
            totalOrders /
              perPage
          ),
        },

        filters: {
          search:
            search.trim(),
          orderStatus,
          paymentStatus,
          sort,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};


// ======================================================
// CANCEL MY ORDER
//
// Customer-facing. Only before dispatch. Returns stock
// to inventory in the same transaction.
// ======================================================

const cancelMyOrder = async (
  req,
  res,
  next
) => {
  const session =
    await mongoose.startSession();

  try {
    const { id } = req.params;

    const { reason } = req.body || {};

    if (
      !mongoose.Types.ObjectId.isValid(id)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    session.startTransaction();

    const order =
      await Order.findOne({
        _id: id,
        user: req.user.userId,
      }).session(session);

    if (!order) {
      await session.abortTransaction();

      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (
      order.orderStatus ===
      "cancelled"
    ) {
      await session.abortTransaction();

      return res.status(409).json({
        success: false,
        message:
          "This order is already cancelled",
      });
    }

    if (
      !CUSTOMER_CANCELLABLE.includes(
        order.orderStatus
      )
    ) {
      await session.abortTransaction();

      return res.status(409).json({
        success: false,
        message:
          `An order that is already ${order.orderStatus.replace(/_/g, " ")} cannot be cancelled. Please contact support.`,
      });
    }

    await restoreOrderStock(
      order,
      session
    );

    order.orderStatus =
      "cancelled";

    order.cancelledAt =
      new Date();

    order.cancelReason =
      (reason || "Cancelled by customer")
        .toString()
        .trim()
        .slice(0, 300);

    await order.save({
      session,
    });

    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message:
        "Order cancelled successfully",
      data: {
        order: {
          id: order._id,
          orderNumber:
            order.orderNumber,
          orderStatus:
            order.orderStatus,
          cancelledAt:
            order.cancelledAt,
        },
      },
    });
  } catch (error) {
    if (
      session.inTransaction()
    ) {
      await session.abortTransaction();
    }

    next(error);
  } finally {
    session.endSession();
  }
};

// ======================================================
// GET ONE ORDER - ADMIN
// ======================================================

const getAdminOrder = async (
  req,
  res,
  next
) => {
  try {
    const { id } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(id)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order =
      await Order.findById(id)
        .populate(
          "user",
          "name email phone"
        )
        .populate("payment")
        .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        order,

        // Tells the admin UI which buttons to render
        // instead of it hardcoding the state machine.
        allowedNextStatuses:
          ALLOWED_TRANSITIONS[
            order.orderStatus
          ] || [],
      },
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// UPDATE ORDER STATUS - ADMIN
//
// Moving an order to "cancelled" restores stock, exactly
// like a customer cancellation.
// ======================================================

const updateOrderStatus = async (
  req,
  res,
  next
) => {
  const session =
    await mongoose.startSession();

  try {
    const { id } = req.params;

    const {
      orderStatus,
      reason,
    } = req.body;

    if (
      !mongoose.Types.ObjectId.isValid(id)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    if (
      !ORDER_STATUSES.includes(
        orderStatus
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          `orderStatus must be one of: ${ORDER_STATUSES.join(", ")}`,
      });
    }

    session.startTransaction();

    const order =
      await Order.findById(
        id
      ).session(session);

    if (!order) {
      await session.abortTransaction();

      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (
      order.orderStatus ===
      orderStatus
    ) {
      await session.abortTransaction();

      return res.status(409).json({
        success: false,
        message:
          `Order is already ${orderStatus}`,
      });
    }

    if (
      !canTransition(
        order.orderStatus,
        orderStatus
      )
    ) {
      await session.abortTransaction();

      const allowed =
        ALLOWED_TRANSITIONS[
          order.orderStatus
        ] || [];

      return res.status(409).json({
        success: false,
        message: allowed.length
          ? `An order that is ${order.orderStatus} can only move to: ${allowed.join(", ")}`
          : `An order that is ${order.orderStatus} cannot change status`,
      });
    }

    if (
      orderStatus === "cancelled"
    ) {
      await restoreOrderStock(
        order,
        session
      );

      order.cancelledAt =
        new Date();

      order.cancelReason =
        (reason || "Cancelled by admin")
          .toString()
          .trim()
          .slice(0, 300);
    }

    if (
      orderStatus === "delivered"
    ) {
      order.deliveredAt =
        new Date();
    }

    order.orderStatus =
      orderStatus;

    await order.save({
      session,
    });

    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message:
        "Order status updated successfully",
      data: {
        order: {
          id: order._id,
          orderNumber:
            order.orderNumber,
          orderStatus:
            order.orderStatus,
          cancelledAt:
            order.cancelledAt,
          deliveredAt:
            order.deliveredAt,
        },

        allowedNextStatuses:
          ALLOWED_TRANSITIONS[
            order.orderStatus
          ] || [],
      },
    });
  } catch (error) {
    if (
      session.inTransaction()
    ) {
      await session.abortTransaction();
    }

    next(error);
  } finally {
    session.endSession();
  }
};

module.exports = {
  getMyOrders,
  getMyOrder,
  cancelMyOrder,
  getAdminOrders,
  getAdminOrder,
  updateOrderStatus,
};