const mongoose = require("mongoose");

const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Address = require("../models/Address");

const {
  ORDER_STATUSES,
  ALLOWED_TRANSITIONS,
  CUSTOMER_CANCELLABLE,
  canTransition,
  restoreOrderStock,
  deductStockForCart,
  calculateTotals,
  codRejectionReason,
} = require("../utils/orderStock");

const generateOrderNumber = () => {
  const timestamp = Date.now();

  const random = Math.floor(
    1000 + Math.random() * 9000
  );

  return `ORD-${timestamp}-${random}`;
};

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

    if (
      order.paymentMethod ===
        "cod" &&
      order.paymentStatus ===
        "pending"
    ) {
      order.paymentStatus =
        "failed";
    }

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

      // Handing over a COD parcel is the moment the cash
      // is collected, so the payment settles with it.
      if (
        order.paymentMethod ===
          "cod" &&
        order.paymentStatus ===
          "pending"
      ) {
        order.paymentStatus =
          "captured";

        order.paidAt = new Date();
      }
    }

    // An unpaid COD order that is cancelled was never
    // owed, so record it as failed rather than pending.
    if (
      orderStatus === "cancelled" &&
      order.paymentMethod ===
        "cod" &&
      order.paymentStatus ===
        "pending"
    ) {
      order.paymentStatus =
        "failed";
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


// ======================================================
// PLACE A CASH ON DELIVERY ORDER
//
// The online path needs Razorpay to confirm the money
// before an order may exist. COD has no such gate, so the
// order is created here and paid for at the door.
//
// Stock still comes out now — otherwise the same unit
// could be promised to several COD customers.
// ======================================================

const placeCodOrder = async (
  req,
  res,
  next
) => {
  const session =
    await mongoose.startSession();

  try {
    const userId =
      req.user.userId;

    const { addressId } =
      req.body;

    if (
      !addressId ||
      !mongoose.Types.ObjectId.isValid(
        addressId
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "A valid addressId is required",
      });
    }

    const address =
      await Address.findOne({
        _id: addressId,
        user: userId,
      });

    if (!address) {
      return res.status(404).json({
        success: false,
        message:
          "Shipping address not found",
      });
    }

    session.startTransaction();

    const cart =
      await Cart.findOne({
        user: userId,
      }).session(session);

    if (
      !cart ||
      !cart.items.length
    ) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message: "Cart is empty",
      });
    }

    // Validates availability and takes the stock
    const {
      orderItems,
      subtotal,
    } = await deductStockForCart(
      cart,
      session
    );

    const {
      shipping,
      total,
    } = calculateTotals(subtotal);

    // Checked after totals because the cap is on order value
    const rejection =
      codRejectionReason(total);

    if (rejection) {
      await session.abortTransaction();

      return res.status(409).json({
        success: false,
        message: rejection,
      });
    }

    const [order] =
      await Order.create(
        [
          {
            orderNumber:
              generateOrderNumber(),

            user: userId,

            items: orderItems,

            shippingAddress: {
              name: address.name,
              phone: address.phone,
              addressLine1:
                address.addressLine1,
              addressLine2:
                address.addressLine2,
              city: address.city,
              state: address.state,
              postalCode:
                address.postalCode,
              country:
                address.country,
            },

            subtotal,

            shipping,

            total,

            paymentMethod: "cod",

            // Nothing has been collected yet
            paymentStatus:
              "pending",

            orderStatus:
              "confirmed",
          },
        ],
        {
          session,
        }
      );

    cart.items = [];

    await cart.save({
      session,
    });

    await session.commitTransaction();

    return res.status(201).json({
      success: true,
      message:
        "Order placed successfully. Pay on delivery.",
      data: {
        order: {
          id: order._id,
          orderNumber:
            order.orderNumber,
          subtotal: order.subtotal,
          shipping: order.shipping,
          total: order.total,
          paymentMethod:
            order.paymentMethod,
          paymentStatus:
            order.paymentStatus,
          orderStatus:
            order.orderStatus,
        },
      },
    });
  } catch (error) {
    if (
      session.inTransaction()
    ) {
      await session.abortTransaction();
    }

    // Stock and availability problems are the customer's
    // to act on, not server faults.
    if (
      /Insufficient stock|no longer available|requires a variant/i.test(
        error.message
      )
    ) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }

    next(error);
  } finally {
    session.endSession();
  }
};

module.exports = {
  getMyOrders,
  getMyOrder,
  placeCodOrder,
  cancelMyOrder,
  getAdminOrders,
  getAdminOrder,
  updateOrderStatus,
};