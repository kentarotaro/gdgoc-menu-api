// src/config/gemini.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

console.log(" Initializing Gemini AI...");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

module.exports = {model};