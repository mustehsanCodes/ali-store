// API Request Logger Middleware
const logger = (req, res, next) => {
  const timestamp = new Date().toISOString()
  const method = req.method
  const url = req.originalUrl || req.url
  const ip = req.ip || req.connection.remoteAddress
  const userAgent = req.get("user-agent") || "Unknown"

  // Log request
  console.log(`[${timestamp}] ${method} ${url} - IP: ${ip}`)
  console.log(`User-Agent: ${userAgent}`)

  // Log request body for POST/PUT/PATCH (excluding sensitive data)
  if (["POST", "PUT", "PATCH"].includes(method) && req.body) {
    const bodyCopy = { ...req.body }
    // Remove sensitive fields if any
    if (bodyCopy.password) delete bodyCopy.password
    console.log(`Request Body:`, JSON.stringify(bodyCopy, null, 2))
  }

  // Log query parameters
  if (Object.keys(req.query).length > 0) {
    console.log(`Query Params:`, JSON.stringify(req.query, null, 2))
  }

  // Capture response
  const originalSend = res.send
  res.send = function (data) {
    const statusCode = res.statusCode
    const responseTime = Date.now() - req.startTime

    // Log response
    console.log(
      `[${timestamp}] ${method} ${url} - Status: ${statusCode} - Time: ${responseTime}ms`,
    )

    // Log error responses
    if (statusCode >= 400) {
      try {
        const errorData = JSON.parse(data)
        console.error(`Error Response:`, JSON.stringify(errorData, null, 2))
      } catch (e) {
        console.error(`Error Response:`, data)
      }
    }

    return originalSend.call(this, data)
  }

  // Set start time
  req.startTime = Date.now()

  next()
}

module.exports = logger

