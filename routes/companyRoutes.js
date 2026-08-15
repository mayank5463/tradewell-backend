const express = require("express");
const router = express.Router();

const { getCompany } = require("../controllers/companyController");

console.log("[COMPANY ROUTES] companyRoutes.js loaded, registering GET /company/:symbol");

router.get("/company/:symbol", getCompany);

module.exports = router;