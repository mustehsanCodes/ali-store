const Loan = require("../models/Loan")
const PDFDocument = require("pdfkit")
const fs = require("fs")
const path = require("path")

// Get all loans
exports.getLoans = async (req, res) => {
  try {
    const { customerName, status, startDate, endDate } = req.query
    let query = {}

    // Filter by customer name
    if (customerName) {
      query.customerName = { $regex: customerName, $options: "i" }
    }

    // Filter by status
    if (status) {
      query.status = status
    }

    // Filter by date range
    if (startDate || endDate) {
      query.loanDate = {}
      if (startDate) {
        query.loanDate.$gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        query.loanDate.$lte = end
      }
    }

    const loans = await Loan.find(query).sort({ loanDate: -1 })

    res.status(200).json({
      success: true,
      count: loans.length,
      data: loans,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    })
  }
}

// Get single loan
exports.getLoan = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id)

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: "Loan not found",
      })
    }

    res.status(200).json({
      success: true,
      data: loan,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    })
  }
}

// Create new loan
exports.createLoan = async (req, res) => {
  try {
    const { customerName, loanAmount, loanDate, dueDate, description, interestRate } = req.body

    // Validate required fields
    if (!customerName || customerName.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Customer name is required and cannot be empty",
      })
    }

    if (!loanAmount) {
      return res.status(400).json({
        success: false,
        message: "Loan amount is required",
      })
    }

    // Validate loan amount is a number and greater than 0
    const amount = parseFloat(loanAmount)
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Loan amount must be a valid number greater than 0",
      })
    }

    // Validate interest rate if provided
    if (interestRate !== undefined && interestRate !== null) {
      const rate = parseFloat(interestRate)
      if (isNaN(rate) || rate < 0) {
        return res.status(400).json({
          success: false,
          message: "Interest rate must be a valid number greater than or equal to 0",
        })
      }
    }

    // Validate dates if provided
    let validatedLoanDate = new Date()
    if (loanDate) {
      validatedLoanDate = new Date(loanDate)
      if (isNaN(validatedLoanDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid loan date format",
        })
      }
    }

    let validatedDueDate = null
    if (dueDate) {
      validatedDueDate = new Date(dueDate)
      if (isNaN(validatedDueDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid due date format",
        })
      }
    }

    const loan = await Loan.create({
      customerName: customerName.trim(),
      loanAmount: amount,
      loanDate: validatedLoanDate,
      dueDate: validatedDueDate,
      description: description || "",
      interestRate: interestRate ? parseFloat(interestRate) : 0,
    })

    console.log(`✅ Loan created successfully: ${loan._id} for customer: ${loan.customerName}`)

    res.status(201).json({
      success: true,
      data: loan,
    })
  } catch (error) {
    console.error("❌ Error creating loan:", error)

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message)

      return res.status(400).json({
        success: false,
        message: "Validation Error",
        error: messages,
      })
    }

    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    })
  }
}

// Update loan
exports.updateLoan = async (req, res) => {
  try {
    const { customerName, loanAmount, loanDate, dueDate, description, interestRate } = req.body

    const loan = await Loan.findById(req.params.id)

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: "Loan not found",
      })
    }

    // Update fields
    if (customerName !== undefined) loan.customerName = customerName
    if (loanAmount !== undefined) loan.loanAmount = loanAmount
    if (loanDate !== undefined) loan.loanDate = loanDate
    if (dueDate !== undefined) loan.dueDate = dueDate
    if (description !== undefined) loan.description = description
    if (interestRate !== undefined) loan.interestRate = interestRate

    await loan.save()

    res.status(200).json({
      success: true,
      data: loan,
    })
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message)

      return res.status(400).json({
        success: false,
        message: "Validation Error",
        error: messages,
      })
    }

    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    })
  }
}

// Add payment to loan
exports.addPayment = async (req, res) => {
  try {
    const { amount, date, description, paymentMethod } = req.body

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Payment amount must be greater than 0",
      })
    }

    const loan = await Loan.findById(req.params.id)

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: "Loan not found",
      })
    }

    // Check if payment exceeds remaining amount
    const remainingAmount = loan.remainingAmount
    if (amount > remainingAmount) {
      return res.status(400).json({
        success: false,
        message: `Payment amount (${amount}) exceeds remaining amount (${remainingAmount})`,
      })
    }

    // Add payment
    loan.payments.push({
      amount,
      date: date || new Date(),
      description,
      paymentMethod: paymentMethod || "Cash",
    })

    // Update status
    loan.updateStatus()

    await loan.save()

    res.status(200).json({
      success: true,
      data: loan,
    })
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message)

      return res.status(400).json({
        success: false,
        message: "Validation Error",
        error: messages,
      })
    }

    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    })
  }
}

// Delete payment from loan
exports.deletePayment = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id)

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: "Loan not found",
      })
    }

    const paymentId = req.params.paymentId
    loan.payments = loan.payments.filter((p) => p._id.toString() !== paymentId)

    // Update status
    loan.updateStatus()

    await loan.save()

    res.status(200).json({
      success: true,
      data: loan,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    })
  }
}

// Delete loan
exports.deleteLoan = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id)

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: "Loan not found",
      })
    }

    await Loan.findByIdAndDelete(req.params.id)

    res.status(200).json({
      success: true,
      data: {},
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    })
  }
}

// Get loans by date range
exports.getLoansByDateRange = async (req, res) => {
  try {
    const { startDate, endDate, customerName } = req.query

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      })
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)

    let query = {
      loanDate: {
        $gte: start,
        $lte: end,
      },
    }

    if (customerName) {
      query.customerName = { $regex: customerName, $options: "i" }
    }

    const loans = await Loan.find(query).sort({ loanDate: -1 })

    res.status(200).json({
      success: true,
      count: loans.length,
      data: loans,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    })
  }
}

// Generate PDF report
exports.generatePDF = async (req, res) => {
  try {
    const { loanId, customerName, startDate, endDate, filterType } = req.query

    let loans = []

    if (loanId) {
      // Generate individual receipt for single loan
      const loan = await Loan.findById(loanId)
      if (!loan) {
        return res.status(404).json({
          success: false,
          message: "Loan not found",
        })
      }
      loans = [loan]
    } else {
      // Generate PDF for filtered loans
      let query = {}

      if (customerName) {
        query.customerName = { $regex: customerName, $options: "i" }
      }

      if (filterType === "daily" && startDate) {
        const start = new Date(startDate)
        const end = new Date(startDate)
        end.setHours(23, 59, 59, 999)
        query.loanDate = { $gte: start, $lte: end }
      } else if (filterType === "monthly" && startDate) {
        const start = new Date(startDate)
        const end = new Date(startDate)
        end.setMonth(end.getMonth() + 1)
        end.setDate(0) // Last day of month
        end.setHours(23, 59, 59, 999)
        query.loanDate = { $gte: start, $lte: end }
      } else if (startDate && endDate) {
        const start = new Date(startDate)
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        query.loanDate = { $gte: start, $lte: end }
      }

      loans = await Loan.find(query).sort({ loanDate: -1 })
    }

    // Create PDF
    const doc = new PDFDocument({ margin: 50 })
    const reportsDir = path.join(__dirname, "../reports")
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true })
    }

    const filename = loanId
      ? `loan-receipt-${loans[0].customerName.replace(/\s+/g, "-")}-${Date.now()}.pdf`
      : `loan-report-${Date.now()}.pdf`
    const filepath = path.join(reportsDir, filename)

    // Helper function to add footer
    const addFooter = () => {
      const footerY = doc.page.height - 50
      const pageWidth = doc.page.width
      const centerX = pageWidth / 2
      
      doc.fontSize(10).fillColor("gray")
      
      // Calculate text width for centering
      const text1 = "Developed by Codenzaar Technologies"
      const text2 = "https://codenzaartechnologies.com/"
      const textWidth1 = doc.widthOfString(text1)
      const textWidth2 = doc.widthOfString(text2)
      
      // Add clickable link text
      doc.text(text1, centerX - textWidth1 / 2, footerY, {
        link: "https://codenzaartechnologies.com/",
        underline: true,
      })
      doc.text(text2, centerX - textWidth2 / 2, footerY + 12, {
        link: "https://codenzaartechnologies.com/",
        underline: true,
      })
      
      doc.fillColor("black")
    }

    // Pipe PDF to response directly (no file needed)
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
    doc.pipe(res)

    // PDF Header
    if (loans.length === 1 && loanId) {
      // Individual Receipt Format
      const loan = loans[0]
      doc.fontSize(24).text("LOAN RECEIPT", { align: "center" })
      doc.moveDown(1)

      // Receipt Number
      doc.fontSize(12).fillColor("gray").text(`Receipt #: ${loan._id}`, { align: "right" })
      doc.fillColor("black")
      doc.moveDown(1)

      // Customer Information
      doc.fontSize(18).text(`Customer Name: ${loan.customerName}`, { align: "left" })
      doc.moveDown(0.5)
      doc.fontSize(14)
      doc.text(`Loan Date: ${new Date(loan.loanDate).toLocaleDateString()}`)
      if (loan.dueDate) {
        doc.text(`Due Date: ${new Date(loan.dueDate).toLocaleDateString()}`)
      }
      doc.moveDown(1)

      // Loan Details Box
      doc.rect(50, doc.y, 500, 120).stroke()
      doc.moveDown(0.5)
      doc.fontSize(16).text("Loan Details", { align: "left" })
      doc.moveDown(0.5)
      doc.fontSize(14)
      doc.text(`Loan Amount: PKR ${loan.loanAmount.toLocaleString()}`)
      doc.text(`Total Paid: PKR ${loan.totalPaid.toLocaleString()}`)
      doc.text(`Remaining Amount: PKR ${loan.remainingAmount.toLocaleString()}`)
      doc.text(`Status: ${loan.status}`)
      if (loan.interestRate > 0) {
        doc.text(`Interest Rate: ${loan.interestRate}%`)
      }
      doc.y += 20

      if (loan.description) {
        doc.moveDown(1)
        doc.fontSize(12).text(`Description: ${loan.description}`)
      }

      // Payment History
      doc.moveDown(1.5)
      doc.fontSize(16).text("Payment History", { underline: true })
      doc.moveDown(0.5)

      if (loan.payments && loan.payments.length === 0) {
        doc.fontSize(12).fillColor("gray").text("No payments recorded yet.")
        doc.fillColor("black")
      } else {
        doc.fontSize(12)
        loan.payments.forEach((payment, index) => {
          doc.text(
            `${index + 1}. PKR ${payment.amount.toLocaleString()} - ${new Date(payment.date).toLocaleDateString()} (${payment.paymentMethod})`,
          )
          if (payment.description) {
            doc.text(`   Note: ${payment.description}`, { indent: 20 })
          }
          doc.moveDown(0.3)
        })
      }
    } else {
      // Multiple loans report
      doc.fontSize(20).text("Loan Management Report", { align: "center" })
      doc.moveDown(0.5)
      doc.fontSize(12).fillColor("gray")
      doc.text(`Generated on: ${new Date().toLocaleString()}`, { align: "center" })
      doc.fillColor("black")
      doc.moveDown(1)

      doc.fontSize(14).text(`Total Loans: ${loans.length}`, { align: "left" })
      if (filterType) {
        doc.text(`Filter: ${filterType}`, { align: "left" })
      }
      if (customerName) {
        doc.text(`Customer: ${customerName}`, { align: "left" })
      }
      doc.moveDown(1)

      let totalLoanAmount = 0
      let totalPaid = 0
      let totalRemaining = 0

      loans.forEach((loan, index) => {
        // Check if we need a new page
        if (doc.y > doc.page.height - 150) {
          addFooter()
          doc.addPage()
        }

        doc.fontSize(12).text(`${index + 1}. ${loan.customerName}`, { underline: true })
        doc.text(`   Loan Amount: PKR ${loan.loanAmount.toLocaleString()}`)
        doc.text(`   Total Paid: PKR ${loan.totalPaid.toLocaleString()}`)
        doc.text(`   Remaining: PKR ${loan.remainingAmount.toLocaleString()}`)
        doc.text(`   Status: ${loan.status}`)
        doc.text(`   Date: ${new Date(loan.loanDate).toLocaleDateString()}`)
        doc.moveDown(0.5)

        totalLoanAmount += loan.loanAmount
        totalPaid += loan.totalPaid
        totalRemaining += loan.remainingAmount
      })

      // Check if we need a new page for summary
      if (doc.y > doc.page.height - 100) {
        addFooter()
        doc.addPage()
      }

      doc.moveDown(1)
      doc.fontSize(14).text("Summary", { underline: true })
      doc.fontSize(12)
      doc.text(`Total Loan Amount: PKR ${totalLoanAmount.toLocaleString()}`)
      doc.text(`Total Paid: PKR ${totalPaid.toLocaleString()}`)
      doc.text(`Total Remaining: PKR ${totalRemaining.toLocaleString()}`)
    }

    // Add footer on every page
    const addFooterToAllPages = () => {
      const pages = doc.bufferedPageRange()
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i)
        addFooter()
      }
    }

    // Add footer before ending
    addFooter()

    doc.end()
  } catch (error) {
    console.error("Error generating PDF:", error)
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    })
  }
}

