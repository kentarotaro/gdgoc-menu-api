// src/utils/logger.js
const log = {
    info: (message) => console.log(`ℹ [INFO] ${message}`),
    success: (message) => console.log(` [SUCCESS] ${message}`),
    warn: (message) => console.warn(` [WARN] ${message}`),
    error: (message) => console.error(` [ERROR] ${message}`),
    debug: (message) => console.log(` [DEBUG] ${message}`)
};

module.exports = log;