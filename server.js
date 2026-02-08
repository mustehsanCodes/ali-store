const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const dotenv = require("dotenv")
const productRoutes = require("./routes/productRoutes")
const saleRoutes = require("./routes/saleRoutes")
const dashboardRoutes = require("./routes/dashboardRoutes")
const loanRoutes = require("./routes/loanRoutes")
const logger = require("./middleware/logger")

// Load environment variables
dotenv.config()

// Initialize Express app
const app = express()

// Middleware
app.use(cors())
app.use(express.json())
app.use(logger)

// Connect to MongoDB with retry logic
const connectDB = async () => {
  try {
    const options = {
      serverSelectionTimeoutMS: 30000, // 30 seconds
      socketTimeoutMS: 45000, // 45 seconds
      connectTimeoutMS: 30000,
      retryWrites: true,
      w: "majority",
    }

    console.log("Attempting to connect to MongoDB...")
    await mongoose.connect(process.env.MONGODB_URI, options)
    console.log("✅ Connected to MongoDB successfully")

    // Handle connection events
    mongoose.connection.on("error", (err) => {
      console.error("MongoDB connection error:", err)
    })

    mongoose.connection.on("disconnected", () => {
      console.warn("MongoDB disconnected. Attempting to reconnect...")
    })

    mongoose.connection.on("reconnected", () => {
      console.log("✅ MongoDB reconnected successfully")
    })
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message)
    console.error("Error details:", {
      code: err.code,
      name: err.name,
      message: err.message,
    })

    if (err.code === "ETIMEOUT" || err.code === "ENOTFOUND") {
      console.error("\n⚠️  Network/IP Access Issue Detected!")
      console.error("Please check the following:")
      console.error("1. Your IP address is whitelisted in MongoDB Atlas")
      console.error("2. Go to MongoDB Atlas → Network Access → Add your current IP")
      console.error("3. Or add 0.0.0.0/0 to allow all IPs (not recommended for production)")
      console.error("4. Check your internet connection")
      console.error("5. Verify MONGODB_URI in .env file is correct")
    }

    // Retry connection after 5 seconds
    setTimeout(() => {
      console.log("Retrying MongoDB connection...")
      connectDB()
    }, 5000)
  }
}

connectDB()

// Routes
app.use("/api/products", productRoutes)
app.use("/api/sales", saleRoutes)
app.use("/api/dashboard", dashboardRoutes)
app.use("/api/loans", loanRoutes)

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({
    success: false,
    message: "Server Error",
    error: process.env.NODE_ENV === "development" ? err.message : "An unexpected error occurred",
  })
})

// Start server
const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

