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

router.route("/").get(getLoans).post(createLoan)

router.route("/:id").get(getLoan).put(updateLoan).delete(deleteLoan)

router.post("/:id/payments", addPayment)
router.delete("/:id/payments/:paymentId", deletePayment)

router.get("/date-range", getLoansByDateRange)
router.get("/generate-pdf", generatePDF)

module.exports = router

