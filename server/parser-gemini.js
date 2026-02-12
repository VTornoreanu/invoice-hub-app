const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Parse bank statement using Gemini AI for intelligent extraction
 * @param {string} filePath - Path to the TXT file
 * @returns {Promise<Array>} - Array of transaction objects
 */
async function parseSparkasseTxtWithGemini(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    const prompt = `You are a financial data extraction expert. Parse this Austrian bank statement (Sparkasse) and extract ALL transactions.

IMPORTANT RULES:
1. The statement header shows the PRINT DATE (e.g., "03.05.2024 12:38"), NOT the transaction dates
2. Transaction dates are in format DDMM (e.g., "0201" = 02.01, "1501" = 15.01)
3. The YEAR must be inferred from context - look for patterns like "per DD.MM.YYYY" in transaction descriptions or "01.24-31.01.24" which indicates year 2024
4. Amounts ending with "-" are DEBITS (negative), others are CREDITS (positive)
5. Extract the counterparty (the entity/person involved in the transaction)
6. Some lines are informational only (e.g., "Information über Nicht-Durchführung") - these are NOT transactions unless they have an amount

Return a JSON array of transactions with this EXACT structure:
[
  {
    "date": "YYYY-MM-DD",
    "description": "full transaction description",
    "counterparty": "entity or person name",
    "amount": -123.45,
    "entity": "extracted entity if available"
  }
]

Bank statement content:
${content}

Return ONLY the JSON array, no explanations or markdown formatting.`;

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent(prompt);
        const response = result.response;
        const responseText = response.text();
        
        // Extract JSON from response
        let jsonText = responseText;
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            jsonText = jsonMatch[1];
        } else {
            // Try to find array brackets
            const arrayMatch = responseText.match(/\[[\s\S]*\]/);
            if (arrayMatch) {
                jsonText = arrayMatch[0];
            }
        }
        
        const transactions = JSON.parse(jsonText);
        
        console.log(`✅ Gemini extracted ${transactions.length} transactions`);
        return transactions;
        
    } catch (error) {
        console.error('❌ Gemini parsing failed:', error.message);
        // Fallback to regex parser
        console.log('⚠️  Falling back to regex parser...');
        const { parseSparkasseTxt } = require('./parser');
        return parseSparkasseTxt(filePath);
    }
}

module.exports = { parseSparkasseTxtWithGemini };
