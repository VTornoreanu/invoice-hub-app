const fs = require('fs');

function parseSparkasseTxt(filePath) {
    console.log(`[${new Date().toISOString()}] parseSparkasseTxt called with: ${filePath}`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    
    let transactions = [];
    let currentYear = '2025'; // Default fallback
    
    // Build a map of line index -> year and statement/page by detecting page footers
    // First pass: collect all pages and their metadata
    const yearByLine = {};
    const statementByLine = {};
    const printDateByStatement = {}; // Map statement -> print date
    const pagesByPrintDate = {}; // Map print date -> {pageNum, year, lineIndex}
    const pageMetadata = []; // Array of {lineIndex, printDate, statement, pageNum, year}
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Detect form feed delimiter (page break)
        if (line.includes('\x0C')) {
            // Footer is 2 lines before the form feed
            if (i >= 2) {
                const footerLine = lines[i - 2];
                // Footer format: "         00001/001          20.06.2023 13:17 AT532025600001491703        00001-491703"
                const dateMatch = footerLine.match(/(\d{2})\.(\d{2})\.(\d{4})\s+\d{2}:\d{2}/);
                const statementMatch = footerLine.match(/(\d{5})\/(\d{3})/); // Extract 00001/001
                if (dateMatch && statementMatch) {
                    const year = dateMatch[3];
                    const printDate = `${dateMatch[1]}.${dateMatch[2]}.${dateMatch[3]}`; // e.g., "20.06.2023"
                    const statement = statementMatch[0]; // e.g., "00001/001"
                    const pageNum = parseInt(statementMatch[2]); // e.g., 1 from "001"
                    
                    // Track print date for this statement
                    printDateByStatement[statement] = printDate;
                    
                    // Track all pages for this print date
                    if (!pagesByPrintDate[printDate]) {
                        pagesByPrintDate[printDate] = [];
                    }
                    pagesByPrintDate[printDate].push({pageNum, year, lineIndex: i, statement});
                    
                    // Store metadata for this page
                    pageMetadata.push({lineIndex: i, printDate, statement, pageNum, year});
                }
            }
        }
    }
    
    // Find the last page for each print date and calculate year for each page
    const lastPageByPrintDate = {};
    const yearByStatement = {}; // Map statement -> calculated year
    
    for (const printDate in pagesByPrintDate) {
        const pages = pagesByPrintDate[printDate];
        const maxPageNum = Math.max(...pages.map(p => p.pageNum));
        lastPageByPrintDate[printDate] = maxPageNum;
        
        // Get year from the last page
        const lastPage = pages.find(p => p.pageNum === maxPageNum);
        const baseYear = parseInt(lastPage.year);
        
        // For each page, calculate the year based on position from last page
        for (const page of pages) {
            const pagesFromEnd = maxPageNum - page.pageNum;
            // Assuming each page is roughly 1 month, count backwards
            // This is a simplification - we'll refine based on actual transaction months
            const statement = `00001/${String(page.pageNum).padStart(3, '0')}`;
            yearByStatement[statement] = baseYear; // Start with base year, will adjust per transaction
        }
    }
    
    console.log('[Parser] Last pages by print date:', lastPageByPrintDate);
    
    // Second pass: assign year and statement to each line
    for (const meta of pageMetadata) {
        const {lineIndex, statement} = meta;
        let startLine = 0;
        // Find previous form feed
        for (let j = lineIndex - 1; j >= 0; j--) {
            if (lines[j].includes('\x0C')) {
                startLine = j + 1;
                break;
            }
        }
        // Mark all lines in this page with this statement
        // Year will be determined per transaction based on month
        for (let j = startLine; j <= lineIndex; j++) {
            statementByLine[j] = statement;
            yearByLine[j] = meta.year; // Temporary, will be refined
        }
    }
    
    // Calculate year for each transaction by processing in reverse order
    // For each statement group (printDate + series), go through transactions backwards
    const yearByTransaction = {}; // Map lineIndex -> calculated year
    
    // Group by printDate + series
    const groupedByPrintDateSeries = {};
    for (const meta of pageMetadata) {
        const seriesMatch = meta.statement.match(/^(\d{5})\//);
        if (seriesMatch) {
            const series = seriesMatch[1];
            const groupKey = `${meta.printDate}_${series}`;
            if (!groupedByPrintDateSeries[groupKey]) {
                groupedByPrintDateSeries[groupKey] = [];
            }
            groupedByPrintDateSeries[groupKey].push(meta);
        }
    }
    
    // Process each group
    for (const groupKey in groupedByPrintDateSeries) {
        const metas = groupedByPrintDateSeries[groupKey];
        const [printDate, series] = groupKey.split('_');
        
        // Find last page
        const maxPageNum = Math.max(...metas.map(m => m.pageNum));
        const lastPageMeta = metas.find(m => m.pageNum === maxPageNum);
        if (!lastPageMeta) continue;
        
        const baseYear = parseInt(lastPageMeta.year);
        
        // Group transactions by page (ONLY from the specific lines belonging to these pages)
        const txsByPage = {};
        for (const meta of metas) {
            // Find the lines for this specific page
            // The page starts some lines after the previous page meta or start of file
            // and ends at its footer (lineIndex).
            const pageEnd = meta.lineIndex;
            // Let's look back 100 lines (a safe page size) or until we hit another page break
            const pageStart = Math.max(0, pageEnd - 100); 

            for (let i = pageStart; i < pageEnd; i++) {
                // If this line belongs to our current statement meta
                if (statementByLine[i] === meta.statement) {
                    const txMatch = lines[i].match(/^\s*(?<desc>.{20,})\s+(?<wert>\d{4})\s+(?<amount>[\d\.,]+,\d{2}\s?-?)$/);
                    if (txMatch) {
                        const month = parseInt(txMatch.groups.wert.substring(2, 4));
                        if (month >= 1 && month <= 12) {
                            if (!txsByPage[meta.pageNum]) {
                                txsByPage[meta.pageNum] = [];
                            }
                            txsByPage[meta.pageNum].push({lineIndex: i, month: month});
                        }
                    }
                }
            }
        }
        
        // Process transactions for the entire group in descending order (bottom to top of document)
        let currentYear = baseYear;
        let prevMonth = null;
        
        // Collect ALL transactions from this group and sort by lineIndex DESCENDING
        const allTxsInGroup = [];
        for (const pageNum in txsByPage) {
            allTxsInGroup.push(...txsByPage[pageNum]);
        }
        allTxsInGroup.sort((a, b) => b.lineIndex - a.lineIndex);

        for (const tx of allTxsInGroup) {
            // Special initialization: if statement printed in Jan/Feb but transaction is Oct/Dec,
            // assume we already crossed a year boundary relative to the print date.
            if (prevMonth === null) {
                const printMonth = parseInt(printDate.split('.')[1]);
                if (printMonth <= 2 && tx.month >= 10) {
                    currentYear--;
                    yearDecrementedInThisGroup = true;
                    console.log(`[Parser] Initial year drop in group ${groupKey}: print month ${printMonth} vs first transaction month ${tx.month}. New year: ${currentYear}`);
                }
            }

            // Month jump while going backwards: e.g. prev was 01, now is 12
            if (prevMonth !== null && tx.month > prevMonth) {
                // Use a threshold of 6 months to distinguish between a year rollover (1 -> 12)
                // and a small ordering jitter (e.g., entry date vs value date 04 -> 03)
                if (tx.month - prevMonth > 6) {
                    currentYear--;
                    console.log(`[Parser] Year boundary detected in group ${groupKey}: ${prevMonth} -> ${tx.month} at line ${tx.lineIndex}. New year: ${currentYear}`);
                }
            }
            
            yearByTransaction[tx.lineIndex] = currentYear;
            prevMonth = tx.month;
        }
    }
    
    let currentTx = null;
    let currentStatement = 'unknown';
    let currentPrintDate = null;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Update current statement from the map
        if (statementByLine[i]) {
            currentStatement = statementByLine[i];
            // Find print date for this statement
            const meta = pageMetadata.find(m => m.statement === currentStatement);
            if (meta) {
                currentPrintDate = meta.printDate;
            }
        }

        // Use the same refined regex to identify real transactions
        const txMatch = line.match(/^\s*(?<desc>.{20,})\s+(?<wert>\d{4})\s+(?<amount>[\d\.,]+,\d{2}\s?-?)$/);
        
        if (txMatch) {
            if (currentTx) transactions.push(currentTx);
            
            const desc = txMatch.groups.desc.trim();
            const wert = txMatch.groups.wert;
            let amountStr = txMatch.groups.amount.trim();
            
            const isDebit = amountStr.endsWith('-');
            const amountClean = amountStr.replace('-', '').replace(/\./g, '').replace(',', '.');
            let amount = parseFloat(amountClean);
            if (isDebit) amount = -amount;
            
            const day = wert.substring(0, 2);
            const month = wert.substring(2, 4);
            
            if (parseInt(month) > 12 || parseInt(day) > 31) continue;
            
            // Calculate year using pre-calculated year for this transaction line
            let txYear = 2026; // Default fallback
            
            if (yearByTransaction[i]) {
                txYear = yearByTransaction[i];
            } else {
                // Fallback to the year from the page metadata
                const meta = pageMetadata.find(m => m.statement === currentStatement);
                if (meta) {
                    txYear = parseInt(meta.year);
                }
            }
            
            const dateStr = `${txYear}-${month}-${day}`;
            
            let counterparty = "";
            if (i + 1 < lines.length) {
                const nextLine = lines[i+1].trim();
                const nextLineIndent = lines[i+1].length - lines[i+1].trimStart().length;
                if (nextLine && nextLineIndent > 5) {
                    if (!nextLine.match(/\d{4}\s+[\d\.,]+\s?-?$/)) {
                        counterparty = nextLine;
                    }
                }
            }
            
            let entity = "";
            if (desc.includes('|')) {
                const parts = desc.split('|').map(p => p.trim());
                if (parts.length >= 2) entity = parts[1];
            }

            currentTx = {
                date: dateStr,
                description: desc,
                counterparty: counterparty,
                amount: amount,
                entity: entity,
                statement: currentStatement
            };
        } else if (currentTx && line.trim() && !line.includes('SPARKASSE')) {
            const indent = line.length - line.trimStart().length;
            if (indent > 5) {
                const stripped = line.trim();
                if (!currentTx.counterparty) {
                    currentTx.counterparty = stripped;
                } else if (!currentTx.description.includes(stripped)) {
                    currentTx.description += " | " + stripped;
                    // Re-check entity if description updated
                    if (currentTx.description.includes('|')) {
                        const parts = currentTx.description.split('|').map(p => p.trim());
                        if (parts.length >= 2) currentTx.entity = parts[1];
                    }
                }
            }
        }
        
        if (line.includes('\x0C') || line.includes('Auszug/Blatt')) {
            if (currentTx) {
                transactions.push(currentTx);
                currentTx = null;
            }
        }
    }
    
    if (currentTx) transactions.push(currentTx);
    
    console.log(`[${new Date().toISOString()}] parseSparkasseTxt returning ${transactions.length} transactions`);
    const jan2024 = transactions.filter(t => t.date.startsWith('2024-01'));
    console.log(`[${new Date().toISOString()}] Ianuarie 2024: ${jan2024.length} tranzacții`);
    if (jan2024.length > 0) {
        console.log(`[${new Date().toISOString()}] Prima tranzacție ian 2024:`, jan2024[0]);
    }
    
    return transactions;
}

module.exports = { parseSparkasseTxt };
