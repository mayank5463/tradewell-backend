const express = require("express");
const router = express.Router();

const { AuthMiddleware } = require("../middleware/AuthMiddleware");
const { getAllOrders, newOrder } = require("../controllers/orderController");

router.get("/allorders", AuthMiddleware, getAllOrders);
router.post("/newOrder", AuthMiddleware, newOrder);

module.exports = router;