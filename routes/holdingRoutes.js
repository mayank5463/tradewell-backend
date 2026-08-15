const express = require("express");
const router = express.Router();

const { AuthMiddleware } = require("../middleware/AuthMiddleware");
const { getAllHoldings } = require("../controllers/holdingController");

router.get("/allholdings", AuthMiddleware, getAllHoldings);

module.exports = router;