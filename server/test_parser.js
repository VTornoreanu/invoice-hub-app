require('dotenv').config();
const { parseSparkasseTxtWithAI } = require('./parser-ai');

async function test() {
    console.log('🧪 Testing AI Parser with Anthropic Claude...\n');
    
    try {
        const transactions = await parseSparkasseTxtWithAI('./test_statement.txt');
        
        console.log(`✅ Successfully parsed ${transactions.length} transactions:\n`);
        
        transactions.forEach((tx, i) => {
            console.log(`${i + 1}. ${tx.date} | ${tx.counterparty} | ${tx.amount} EUR`);
        });
        
        console.log('\n📊 Full transaction details:');
        console.log(JSON.stringify(transactions, null, 2));
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
    }
}

test();
