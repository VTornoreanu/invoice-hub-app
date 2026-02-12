require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const morgan = require('morgan');
const { 
    initDb, 
    insertTransactions, 
    getTransactions, 
    addDocument, 
    getTxDocuments, 
    getSuggestions, 
    clearDb,
    toggleAccounted,
    toggleProcessed,
    updateExplanation,
    addComment,
    getComments,
    getEntities,
    getReportData,
    getUnsentComments,
    markCommentsAsSent,
    getPdfStatements,
    addPdfStatement,
    deletePdfStatement,
    addManualTransaction,
    getUsers,
    addUser,
    deleteUser,
    updateUser,
    deleteManualTransaction,
    clearManualTransactions
} = require('./db');
const { parseSparkasseTxtWithAI } = require('./parser-ai');
const { parseSparkasseTxt } = require('./parser');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'box.analysishub.pro',
    port: 465,
    secure: true,
    auth: {
        user: 'rechnung@analysishub.pro',
        pass: '?ithubaJ1!VT'
    }
});

const app = express();
const upload = multer({ dest: 'uploads/' });
const attachmentsDir = path.join(__dirname, 'attachments');
// Create dirs
const pdfsDir = path.join(__dirname, 'pdf_statements');
if (!fs.existsSync(pdfsDir)) fs.mkdirSync(pdfsDir);

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Get all transactions
app.get('/api/transactions', async (req, res) => {
    try {
        const { source } = req.query;
        const txs = await getTransactions(source);
        res.json(txs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PDF Statements Management
app.get('/api/pdfs', async (req, res) => {
    try {
        const pdfs = await getPdfStatements();
        res.json(pdfs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/pdfs', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');
    const { periodStart, periodEnd } = req.body;
    try {
        const filename = req.file.filename + '.pdf';
        const targetPath = path.join(pdfsDir, filename);
        fs.renameSync(req.file.path, targetPath);
        await addPdfStatement(filename, req.file.originalname, periodStart, periodEnd);
        res.json({ message: 'PDF statement uploaded successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/pdfs/:id', async (req, res) => {
    try {
        // Find filename first to delete file
        // For now just delete from DB, but better to delete file too
        await deletePdfStatement(req.params.id);
        res.json({ message: 'PDF statement deleted.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Temporary fix - copy this into index.js at line 101
app.get('/api/pdfs/view/:filename', (req, res) => {
    const filePath = path.join(pdfsDir, req.params.filename);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'inline'
            }
        });
    } else {
        res.status(404).send('File not found');
    }
});

// User Management
app.get('/api/users', async (req, res) => {
    try {
        const users = await getUsers();
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/users', async (req, res) => {
    const { email, password, role, name, phone } = req.body;
    try {
        await addUser(email, password, role, name, phone);
        res.json({ message: 'User added successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/users/:id', async (req, res) => {
    const { email, password, role, name, phone } = req.body;
    console.log('PUT /api/users/:id', { id: req.params.id, email, password: password ? '***' : 'empty', role, name, phone });
    try {
        await updateUser(req.params.id, email, password, role, name, phone);
        res.json({ message: 'User updated successfully.' });
    } catch (err) {
        console.error('Update user error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        await deleteUser(req.params.id);
        res.json({ message: 'User deleted successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Manual Transactions
app.post('/api/transactions/manual', async (req, res) => {
    console.log('Manual transaction data:', req.body);
    try {
        const id = await addManualTransaction(req.body);
        res.json({ message: 'Manual transaction created.', id });
    } catch (err) {
        console.error('Manual transaction error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Exchange Rate API (ECB data via Frankfurter)
app.get('/api/exchange-rate/:date/:currency', async (req, res) => {
    try {
        const { date, currency } = req.params;
        
        // Frankfurter API uses ECB data (official EU exchange rates)
        const response = await fetch(`https://api.frankfurter.app/${date}?from=${currency}&to=EUR`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch exchange rate');
        }
        
        const data = await response.json();
        const rate = data.rates?.EUR;
        
        if (!rate) {
            throw new Error('Exchange rate not available for this date/currency');
        }
        
        res.json({ 
            date: data.date, 
            currency, 
            rate,
            source: 'ECB (via Frankfurter API)'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/transactions/manual/:id', async (req, res) => {
    try {
        await deleteManualTransaction(req.params.id);
        res.json({ message: 'Manual transaction deleted.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/reset-manual', async (req, res) => {
    try {
        await clearManualTransactions();
        res.json({ message: 'Manual transactions cleared successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Upload transactions (TXT)
app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');
    try {
        const txs = parseSparkasseTxt(req.file.path);
        await insertTransactions(txs);
        fs.unlinkSync(req.file.path);
        res.json({ message: `Successfully processed ${txs.length} transactions.`, count: txs.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Toggle accounted status
app.post('/api/transactions/:id/accounted', async (req, res) => {
    try {
        await toggleAccounted(req.params.id, req.body.status);
        res.json({ message: 'Accounted status updated.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/transactions/:id/processed', async (req, res) => {
    try {
        const { status } = req.body;
        await toggleProcessed(req.params.id, status);
        res.json({ message: 'Processed status updated.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Document Upload
app.post('/api/transactions/:id/documents', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');
    const txId = req.params.id;
    try {
        const ext = path.extname(req.file.originalname) || '';
        const filename = req.file.filename + ext;
        const targetPath = path.join(attachmentsDir, filename);
        fs.renameSync(req.file.path, targetPath);
        await addDocument(txId, filename, req.file.originalname, req.file.mimetype);
        res.json({ message: 'Document attached successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Documents for a transaction
app.get('/api/transactions/:id/documents', async (req, res) => {
    try {
        const docs = await getTxDocuments(req.params.id);
        res.json(docs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Download/View Document
app.get('/api/documents/:filename', async (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(attachmentsDir, filename);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('File not found');
    }
});

// Toggle Accounted Status
app.post('/api/transactions/:id/accounted', async (req, res) => {
    const { status } = req.body;
    try {
        await toggleAccounted(req.params.id, status);
        res.json({ message: 'Status updated.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/transactions/:id/explanation', async (req, res) => {
    const { explanation } = req.body;
    try {
        await updateExplanation(req.params.id, explanation);
        res.json({ message: 'Explanation updated.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Chat Comments
app.post('/api/transactions/:id/comments', async (req, res) => {
    const { userEmail, userRole, text } = req.body;
    try {
        await addComment(req.params.id, userEmail, userRole, text);
        res.json({ message: 'Comment added.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/transactions/:id/comments', async (req, res) => {
    try {
        const comments = await getComments(req.params.id);
        res.json(comments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Autocomplete suggestions
app.get('/api/suggestions', async (req, res) => {
    try {
        const suggestions = await getSuggestions();
        res.json(suggestions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get master list of entities
app.get('/api/entities', async (req, res) => {
    try {
        const entities = await getEntities();
        res.json(entities);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// User management endpoints
app.get('/api/users', async (req, res) => {
    try {
        const users = await getUsers();
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/users', async (req, res) => {
    const { email, password, role } = req.body;
    try {
        await addUser(email, password, role);
        res.json({ message: 'User added.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        await deleteUser(req.params.id);
        res.json({ message: 'User deleted.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Email notification endpoints
app.get('/api/comments/unsent/count', async (req, res) => {
    try {
        const unsent = await getUnsentComments();
        res.json({ count: unsent.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

function formatDescriptionHTML(text) {
    if (!text) return '';
    const tags = ['SVWZ+', 'ABWA+', 'EREF+', 'MREF+', 'CRED+', 'IBAN+', 'BIC+', 'KREF+'];
    let lines = [text];
    tags.forEach(tag => {
        lines = lines.flatMap(line => {
            if (typeof line !== 'string') return line;
            const parts = line.split(tag);
            if (parts.length <= 1) return line;
            return [parts[0], ...parts.slice(1).map(p => tag + p)];
        });
    });
    
    const tableRows = lines.filter(l => l && l.trim()).map(line => {
        const tag = tags.find(t => line.startsWith(t));
        if (tag) {
            const content = line.replace(tag, '');
            return `<tr><td style="padding: 2px 8px 2px 0; font-weight: bold; width: 60px; vertical-align: top; color: #666; font-family: monospace; border-bottom: 1px solid #f0f0f0;">${tag.replace('+', '')}</td><td style="padding: 2px 0; vertical-align: top; border-bottom: 1px solid #f0f0f0;">${content}</td></tr>`;
        }
        return `<tr><td colspan="2" style="padding: 6px 0; border-bottom: 1px solid #e0e0e0; font-weight: 600;">${line}</td></tr>`;
    }).join('');

    return `<table style="width: 100%; border-collapse: collapse; font-family: sans-serif; font-size: 13px;">${tableRows}</table>`;
}

app.post('/api/send-report', async (req, res) => {
    const { to, type, transactionId } = req.body; 
    if (!to) return res.status(400).json({ error: 'Recipient email is required.' });

    try {
        const includeComments = type === 'comments' || type === 'both';
        const includeDocs = type === 'docs' || type === 'both';
        
        const transactions = await getReportData(includeComments, includeDocs, transactionId);
        if (transactions.length === 0) {
            return res.json({ message: 'No transactions found for the selected criteria.' });
        }

        const isSingle = !!transactionId;
        const mainTitle = isSingle ? `Bericht für Transaktion: ${transactions[0].counterparty || 'N/A'}` : 'Bankauszüge Bericht (Sammelbericht)';

        let htmlContent = `
            <div style="font-family: sans-serif; max-width: 800px; margin: 0 auto; color: #333;">
                <h2 style="color: #6366f1; border-bottom: 2px solid #6366f1; padding-bottom: 10px;">${mainTitle}</h2>
                <p style="color: #666;">Typ: ${type === 'both' ? 'Kommentare & Dokumente' : type === 'comments' ? 'Nur Kommentare' : 'Nur Dokumente'}</p>
        `;

        const attachments = [];
        const commentIdsToMark = [];

        for (const tx of transactions) {
            const txDocs = await getTxDocuments(tx.id);
            const txComments = await getComments(tx.id);
            const unsentComments = txComments.filter(c => c.is_sent === 0);
            
            // Mark unsent comments as sent regardless of isSingle (if includeComments is true)
            if (includeComments && unsentComments.length > 0) {
                commentIdsToMark.push(...unsentComments.map(c => c.id));
            }

            // In single report, we show ALL comments to give context. 
            // In batch report, we only show UNSENT comments.
            const commentsToDisplay = isSingle ? txComments : unsentComments;

            htmlContent += `
                <div style="margin-bottom: 30px; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 15px; border-bottom: 1px solid #f3f4f6; padding-bottom: 10px;">
                        <span style="font-weight: bold; font-size: 16px;">${tx.counterparty || 'N/A'}</span>
                        <span style="color: ${tx.amount >= 0 ? '#10b981' : '#ef4444'}; font-weight: bold;">${tx.amount.toFixed(2)} EUR</span>
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <div style="font-size: 12px; color: #9ca3af; text-transform: uppercase; margin-bottom: 5px;">Datum</div>
                        <div style="font-size: 14px;">${tx.date}</div>
                    </div>

                    <div style="margin-bottom: 15px;">
                        <div style="font-size: 12px; color: #9ca3af; text-transform: uppercase; margin-bottom: 5px;">Transaktion Text</div>
                        <div style="background: #f9fafb; padding: 10px; border-radius: 8px;">
                            ${formatDescriptionHTML(tx.description)}
                        </div>
                    </div>

                    ${tx.explanation ? `
                    <div style="margin-bottom: 15px;">
                        <div style="font-size: 12px; color: #8b5cf6; text-transform: uppercase; margin-bottom: 5px; font-weight: bold;">Explicația lui Virgil</div>
                        <div style="background: rgba(139, 92, 246, 0.05); border-left: 3px solid #8b5cf6; padding: 10px; border-radius: 4px; font-style: italic;">
                            ${tx.explanation}
                        </div>
                    </div>
                    ` : ''}

                    ${includeComments && commentsToDisplay.length > 0 ? `
                    <div style="margin-bottom: 15px;">
                        <div style="font-size: 12px; color: #6366f1; text-transform: uppercase; margin-bottom: 5px;">Kommentare</div>
                        ${commentsToDisplay.map(c => `
                            <div style="margin-bottom: 8px; font-size: 14px;">
                                <strong style="color: #4b5563;">${c.user_email.split('@')[0]}:</strong> ${c.text}
                                <span style="font-size: 11px; color: #9ca3af; margin-left: 8px;">(${new Date(c.created_at).toLocaleDateString()})</span>
                            </div>
                        `).join('')}
                    </div>
                    ` : ''}

                    ${includeDocs && txDocs.length > 0 ? `
                    <div style="margin-bottom: 5px;">
                        <div style="font-size: 12px; color: #9ca3af; text-transform: uppercase; margin-bottom: 5px;">Dokumente</div>
                        <div style="font-size: 13px; color: #4b5563;">${txDocs.length} Datei/en angehängt</div>
                    </div>
                    ` : ''}
                </div>
            `;

            // Add documents to attachments
            if (includeDocs) {
                for (const doc of txDocs) {
                    const filePath = path.join(attachmentsDir, doc.filename);
                    if (fs.existsSync(filePath)) {
                        attachments.push({
                            filename: doc.original_name,
                            path: filePath
                        });
                    }
                }
            }
        }

        htmlContent += `
                <p style="font-size: 12px; color: #9ca3af; text-align: center; margin-top: 40px;">Baza de date Extrase Bancare - Raport Automat</p>
            </div>
        `;

        const mailOptions = {
            from: 'rechnung@analysishub.pro',
            to: to,
            subject: isSingle ? `Extrakt: ${transactions[0].counterparty || 'Transaktion'}` : `Sammelbericht (${transactions.length} Tranz.)`,
            html: htmlContent,
            attachments: attachments
        };

        await transporter.sendMail(mailOptions);
        if (commentIdsToMark.length > 0) {
            await markCommentsAsSent(commentIdsToMark);
        }
        
        res.json({ message: `Bericht (${type}) erfolgreich an ${to} gesendet.` });
    } catch (err) {
        console.error('Email error:', err);
        res.status(500).json({ error: 'E-Mail-Versand fehlgeschlagen: ' + err.message });
    }
});

app.post('/api/send-comments', async (req, res) => {
    // Keep old endpoint for simple comment forwarding (legacy)
    req.body.type = 'comments';
    return app._router.handle({ method: 'POST', url: '/api/send-report', body: req.body }, res);
});

// Reset Database
app.post('/api/reset', async (req, res) => {
    try {
        await clearDb();
        res.json({ message: 'Database cleared successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = 3001;
initDb().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
});

