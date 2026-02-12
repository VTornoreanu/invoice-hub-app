require('dotenv').config();
const { parseSparkasseTxtWithAI } = require('./parser-ai');

async function test() {
    console.log('🧪 Testing AI Parser with multi-year statement...\n');
    
    try {
        const transactions = await parseSparkasseTxtWithAI('../AT532025600001491703_2023001_2023002_2024001_2024002_2024003_2025001_2025002_2025003_2026002_202.txt');
        
        console.log(`✅ Successfully parsed ${transactions.length} transactions\n`);
        
        // Group by year
        const byYear = {};
        transactions.forEach(tx => {
            const year = tx.date.substring(0, 4);
            if (!byYear[year]) byYear[year] = [];
            byYear[year].push(tx);
        });
        
        console.log('📊 Transactions by year:');
        Object.keys(byYear).sort().forEach(year => {
            console.log(`  ${year}: ${byYear[year].length} transactions`);
        });
        
        console.log('\n🔍 Sample transactions from each year:');
        Object.keys(byYear).sort().forEach(year => {
            const sample = byYear[year][0];
            console.log(`  ${sample.date} | ${sample.counterparty} | ${sample.amount} EUR`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
    }
}

test();
