const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');

// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
});

/**
 * Parse bank statement using Claude AI for intelligent extraction
 * @param {string} filePath - Path to the TXT file
 * @param {number} forceYear - Optional year to force (overrides AI detection)
 * @returns {Promise<Array>} - Array of transaction objects
 */
async function parseSparkasseTxtWithAI(filePath, forceYear = null) {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    let yearInstruction = '';
    if (forceYear) {
        yearInstruction = `\n\nIMPORTANT: The user has specified that ALL transactions in this statement are from year ${forceYear}. Use this year for all transactions, ignoring any other year detection logic.`;
    }
    
    const prompt = `You are a financial data extraction expert. Parse this Austrian bank statement (Sparkasse) and extract ALL transactions.

CRITICAL YEAR DETECTION RULES FOR MULTI-YEAR STATEMENTS:
This file may contain MULTIPLE bank statements from DIFFERENT YEARS concatenated together!

1. **PRIMARY SOURCE**: Look for "*** Abschlussbuchung per DD.MM.YYYY ****" lines
   Example: "*** Abschlussbuchung per 30.06.2022 ****" means transactions BEFORE this line are from the period ending June 2022
   Example: "*** Abschlussbuchung per 31.12.2023 ****" means transactions BEFORE this line are from the period ending December 2023
   
2. **HOW TO DETERMINE YEAR FOR EACH TRANSACTION**:
   - Find the NEXT "Abschlussbuchung" line AFTER the transaction
   - Use the YEAR from that Abschlussbuchung date
   - Example: If transaction has date "0201" (02.01) and next Abschlussbuchung is "per 31.03.2023", the transaction is from 2023-01-02
   
3. **ALTERNATIVE**: Look for "Kontostand per DD.MM.YYYY" lines which show the statement period
   Example: "Kontostand per 31.03.2023" indicates this section covers transactions up to March 2023

4. **FOOTER DATE**: Each page has a footer like "00001/007          03.05.2024 12:38 AT532025600001491703"
   This is the PRINT DATE, not the transaction period. Ignore it for year detection!

5. Transaction dates are in format DDMM without year (e.g., "0201" = DAY 02, MONTH 01 = January 2nd)
   IMPORTANT: This is EUROPEAN format (DD/MM), NOT American (MM/DD)!
   - "0201" = 02.01 = 2nd of January, NOT February 1st
   - "0301" = 03.01 = 3rd of January, NOT March 1st
   - "1501" = 15.01 = 15th of January
   - "0501" = 05.01 = 5th of January

EXAMPLE LOGIC:
- Transaction with "0107" (01.07 = July 1st)
- Next Abschlussbuchung: "*** Abschlussbuchung per 30.09.2022 ****"
- Therefore: transaction date is 2022-07-01

- Transaction with "0201" (02.01 = January 2nd)  
- Next Abschlussbuchung: "*** Abschlussbuchung per 31.03.2023 ****"
- Therefore: transaction date is 2023-01-02

OTHER RULES:
1. Amounts ending with "-" are DEBITS (negative), others are CREDITS (positive)
2. Extract the counterparty (the entity/person involved)
3. Skip informational messages that don't have transaction amounts

Return a JSON array with this EXACT structure:
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
${yearInstruction}

Return ONLY the JSON array, no explanations.`;

    try {
        const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            messages: [{
                role: 'user',
                content: prompt
            }]
        });

        const responseText = message.content[0].text;
        
        // Extract JSON from response (in case Claude adds markdown formatting)
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
        
        console.log(`✅ Claude extracted ${transactions.length} transactions`);
        return transactions;
        
    } catch (error) {
        console.error('❌ Claude parsing failed:', error.message);
        // Fallback to regex parser
        console.log('⚠️  Falling back to regex parser...');
        const { parseSparkasseTxt } = require('./parser');
        return parseSparkasseTxt(filePath);
    }
}

module.exports = { parseSparkasseTxtWithAI };
