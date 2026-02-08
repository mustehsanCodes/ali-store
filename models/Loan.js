const mongoose = require("mongoose")

const paymentSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
    min: [0.01, "Payment amount must be greater than 0"],
  },
  date: {
    type: Date,
    default: Date.now,
  },
  description: {
    type: String,
    default: "",
  },
  paymentMethod: {
    type: String,
    enum: ["Cash", "Card", "Bank Transfer"],
    default: "Cash",
  },
})

const loanSchema = new mongoose.Schema(
  {
    customerName: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
    },
    loanAmount: {
      type: Number,
      required: [true, "Loan amount is required"],
      min: [0.01, "Loan amount must be greater than 0"],
    },
    payments: {
      type: [paymentSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ["Active", "Paid", "Overdue"],
      default: "Active",
    },
    loanDate: {
      type: Date,
      default: Date.now,
    },
    dueDate: {
      type: Date,
    },
    description: {
      type: String,
      default: "",
    },
    interestRate: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
)

// Virtual for total paid amount
loanSchema.virtual("totalPaid").get(function () {
  return this.payments.reduce((sum, payment) => sum + payment.amount, 0)
})

// Virtual for remaining amount
loanSchema.virtual("remainingAmount").get(function () {
  return this.loanAmount - this.totalPaid
})

// Virtual for payment percentage
loanSchema.virtual("paymentPercentage").get(function () {
  if (this.loanAmount === 0) return 0
  return (this.totalPaid / this.loanAmount) * 100
})

// Ensure virtuals are included in JSON
loanSchema.set("toJSON", { virtuals: true })
loanSchema.set("toObject", { virtuals: true })

// Update status based on payments
loanSchema.methods.updateStatus = function () {
  const remaining = this.remainingAmount
  if (remaining <= 0) {
    this.status = "Paid"
  } else if (this.dueDate && new Date() > this.dueDate) {
    this.status = "Overdue"
  } else {
    this.status = "Active"
  }
}

// Pre-save hook to update status
loanSchema.pre("save", function (next) {
  this.updateStatus()
  next()
})

module.exports = mongoose.model("Loan", loanSchema)

