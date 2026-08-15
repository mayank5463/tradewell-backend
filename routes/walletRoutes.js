const express = require("express");
const router = express.Router();

const { AuthMiddleware } = require("../middleware/AuthMiddleware");
const { getMyWallet, getMyLedger, resetMyAccount } = require("../controllers/walletController");

router.get("/wallet", AuthMiddleware, getMyWallet);
router.get("/wallet/transactions", AuthMiddleware, getMyLedger);
router.post("/wallet/reset", AuthMiddleware, resetMyAccount);

module.exports = router;