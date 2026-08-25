const mongoose = require("mongoose");

const Order = require("../models/Order");

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

module.exports = {
  getMyOrders,
  getMyOrder,
};