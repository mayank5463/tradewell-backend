const express = require("express");
const router = express.Router();

const { AuthMiddleware } = require("../middleware/AuthMiddleware");
const { getAllPositions } = require("../controllers/positionController");

router.get("/allpositions", AuthMiddleware, getAllPositions);

module.exports = router;