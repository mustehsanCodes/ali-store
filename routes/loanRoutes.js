const express = require("express")
const router = express.Router()
const {
  getLoans,
  getLoan,
  createLoan,
  updateLoan,
  deleteLoan,
  addPayment,
  deletePayment,
  getLoansByDateRange,
  generatePDF,
} = require("../controllers/loanController")

// IMPORTANT: Specific routes must come BEFORE parameterized routes
router.get("/date-range", getLoansByDateRange)
router.get("/generate-pdf", generatePDF)

router.route("/").get(getLoans).post(createLoan)

router.post("/:id/payments", addPayment)
router.delete("/:id/payments/:paymentId", deletePayment)

router.route("/:id").get(getLoan).put(updateLoan).delete(deleteLoan)

module.exports = router

