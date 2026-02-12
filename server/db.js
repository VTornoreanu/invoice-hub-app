const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'bank.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Error opening database', err);
    else console.log('Connected to SQLite');
});

function initDb() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Transactions table with source column
            db.run(`CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT,
                description TEXT,
                counterparty TEXT,
                entity TEXT,
                amount REAL,
                is_accounted INTEGER DEFAULT 0,
                is_processed INTEGER DEFAULT 0,
                explanation TEXT,
                hash TEXT UNIQUE,
                source TEXT DEFAULT 'bank',
                original_currency TEXT,
                original_amount REAL
            )`);

            // PDFs table
            db.run(`CREATE TABLE IF NOT EXISTS statements_pdf (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT,
                original_name TEXT,
                upload_date TEXT,
                period_start TEXT,
                period_end TEXT
            )`);

            // Users table
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE,
                password TEXT,
                role TEXT,
                name TEXT,
                phone TEXT
            )`, () => {
                // Seed default users if empty
                db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
                    if (row && row.count === 0) {
                        db.run("INSERT INTO users (email, password, role) VALUES (?, ?, ?)", ['virgil@tornoreanu.ro', 'admin123', 'admin']);
                        db.run("INSERT INTO users (email, password, role) VALUES (?, ?, ?)", ['contabil@tornoreanu.ro', 'contabil123', 'accountant']);
                    }
                });
            });

            // Comments table
            db.run(`CREATE TABLE IF NOT EXISTS comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transaction_id INTEGER,
                user_email TEXT,
                user_role TEXT,
                text TEXT,
                created_at TEXT,
                is_sent INTEGER DEFAULT 0,
                FOREIGN KEY(transaction_id) REFERENCES transactions(id)
            )`);

            // Entities table (Master List)
            db.run(`CREATE TABLE IF NOT EXISTS entities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE
            )`);

            // Documents table
            db.run(`CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transaction_id INTEGER,
                filename TEXT,
                original_name TEXT,
                mime_type TEXT,
                upload_date TEXT,
                FOREIGN KEY(transaction_id) REFERENCES transactions(id)
            )`, (err) => {
                if (err) reject(err);
                else {
                    // Migration: Add original_currency and original_amount columns if they don't exist
                    db.run(`ALTER TABLE transactions ADD COLUMN original_currency TEXT`, () => {});
                    db.run(`ALTER TABLE transactions ADD COLUMN original_amount REAL`, () => {});
                    // Migration: Add is_processed column if it doesn't exist
                    db.run(`ALTER TABLE transactions ADD COLUMN is_processed INTEGER DEFAULT 0`, () => {});
                    resolve();
                }
            });
        });
    });
}

function insertTransactions(txs) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`INSERT OR IGNORE INTO transactions (date, description, counterparty, entity, amount, hash) VALUES (?, ?, ?, ?, ?, ?)`);
        const entityStmt = db.prepare(`INSERT OR IGNORE INTO entities (name) VALUES (?)`);
        
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            txs.forEach(tx => {
                const hash = `${tx.date}|${tx.amount}|${tx.description.substring(0, 50)}|${tx.counterparty}`;
                stmt.run(tx.date, tx.description, tx.counterparty, tx.entity || '', tx.amount, hash);
                if (tx.entity) {
                    entityStmt.run(tx.entity);
                }
            });
            db.run('COMMIT', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    });
}

function getTransactions(source = null) {
    return new Promise((resolve, reject) => {
        let where = '';
        const params = [];
        if (source) {
            where = 'WHERE t.source = ?';
            params.push(source);
        }
        const query = `
            SELECT 
                t.*, 
                COUNT(DISTINCT d.id) as document_count,
                COUNT(DISTINCT c.id) as comment_count,
                MAX(c.created_at) as last_comment_at
            FROM transactions t
            LEFT JOIN documents d ON t.id = d.transaction_id
            LEFT JOIN comments c ON t.id = c.transaction_id
            ${where}
            GROUP BY t.id
            ORDER BY t.date DESC
        `;
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function addDocument(txId, filename, originalName, mimeType) {
    return new Promise((resolve, reject) => {
        const query = `INSERT INTO documents (transaction_id, filename, original_name, mime_type, upload_date) VALUES (?, ?, ?, ?, ?)`;
        const date = new Date().toISOString();
        db.run(query, [txId, filename, originalName, mimeType, date], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

function getTxDocuments(txId) {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM documents WHERE transaction_id = ?', [txId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function getSuggestions() {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT DISTINCT counterparty as text FROM transactions WHERE counterparty IS NOT NULL AND counterparty != ''
            UNION
            SELECT DISTINCT entity as text FROM transactions WHERE entity IS NOT NULL AND entity != ''
            UNION
            SELECT DISTINCT description as text FROM transactions WHERE description IS NOT NULL AND description != ''
            LIMIT 100
        `;
        db.all(query, (err, rows) => {
            if (err) reject(err);
            else resolve(rows.map(r => r.text));
        });
    });
}

function clearDb() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run('DELETE FROM documents');
            db.run('DELETE FROM transactions', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    });
}

function toggleAccounted(txId, status) {
    return new Promise((resolve, reject) => {
        db.run('UPDATE transactions SET is_accounted = ? WHERE id = ?', [status ? 1 : 0, txId], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function toggleProcessed(txId, status) {
    return new Promise((resolve, reject) => {
        db.run('UPDATE transactions SET is_processed = ? WHERE id = ?', [status ? 1 : 0, txId], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function updateExplanation(txId, explanation) {
    return new Promise((resolve, reject) => {
        db.run('UPDATE transactions SET explanation = ? WHERE id = ?', [explanation, txId], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function addComment(txId, userEmail, userRole, text) {
    return new Promise((resolve, reject) => {
        const query = `INSERT INTO comments (transaction_id, user_email, user_role, text, created_at) VALUES (?, ?, ?, ?, ?)`;
        const date = new Date().toISOString();
        db.run(query, [txId, userEmail, userRole, text, date], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function getComments(txId) {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM comments WHERE transaction_id = ? ORDER BY created_at ASC', [txId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function getEntities() {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT DISTINCT name FROM (
                SELECT name FROM entities
                UNION
                SELECT entity as name FROM transactions WHERE entity IS NOT NULL AND entity != ''
                UNION
                SELECT counterparty as name FROM transactions WHERE counterparty IS NOT NULL AND counterparty != '' AND counterparty != 'Herr/Frau/Firma'
            ) ORDER BY name ASC
        `;
        db.all(query, (err, rows) => {
            if (err) reject(err);
            else resolve(rows.map(r => r.name));
        });
    });
}
function getReportData(includeComments, includeDocs, txId = null) {
    return new Promise((resolve, reject) => {
        let whereClause = [];
        if (txId) {
            whereClause.push('t.id = ?');
        } else {
            if (includeComments) whereClause.push('c.is_sent = 0');
            if (includeDocs) whereClause.push('t.id IN (SELECT transaction_id FROM documents)');
        }
        
        const query = `
            SELECT DISTINCT
                t.*,
                (SELECT COUNT(*) FROM documents d WHERE d.transaction_id = t.id) as document_count,
                (SELECT COUNT(*) FROM comments c2 WHERE c2.transaction_id = t.id) as comment_count
            FROM transactions t
            LEFT JOIN comments c ON t.id = c.transaction_id
            WHERE ${whereClause.length > 0 ? whereClause.join(' OR ') : '1=1'}
            ORDER BY t.date DESC
        `;
        
        const params = txId ? [txId] : [];
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}


function getUnsentComments() {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT 
                c.*, 
                t.date, 
                t.counterparty, 
                t.amount, 
                t.description,
                t.explanation,
                (SELECT COUNT(*) FROM documents d WHERE d.transaction_id = t.id) as document_count
            FROM comments c
            JOIN transactions t ON c.transaction_id = t.id
            WHERE c.is_sent = 0
            ORDER BY c.created_at ASC
        `;
        db.all(query, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function markCommentsAsSent(commentIds) {
    if (!commentIds || commentIds.length === 0) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const placeholders = commentIds.map(() => '?').join(',');
        db.run(`UPDATE comments SET is_sent = 1 WHERE id IN (${placeholders})`, commentIds, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

// Migration for existing table
function migrate() {
    db.run("ALTER TABLE transactions ADD COLUMN source TEXT DEFAULT 'bank'", (err) => {});
    db.run("ALTER TABLE statements_pdf ADD COLUMN period_start TEXT", (err) => {});
    db.run("ALTER TABLE statements_pdf ADD COLUMN period_end TEXT", (err) => {});
    db.run("ALTER TABLE users ADD COLUMN name TEXT", (err) => {});
    db.run("ALTER TABLE users ADD COLUMN phone TEXT", (err) => {});
}
migrate();

function getPdfStatements() {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM statements_pdf ORDER BY upload_date DESC", (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function addPdfStatement(filename, originalName, periodStart = null, periodEnd = null) {
    return new Promise((resolve, reject) => {
        const date = new Date().toISOString();
        db.run("INSERT INTO statements_pdf (filename, original_name, upload_date, period_start, period_end) VALUES (?, ?, ?, ?, ?)", 
            [filename, originalName, date, periodStart, periodEnd], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

function deletePdfStatement(id) {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM statements_pdf WHERE id = ?", [id], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function addManualTransaction(tx) {
    return new Promise((resolve, reject) => {
        const { date, description, counterparty, entity, amount, original_currency, original_amount } = tx;
        
        // Use the amount from the request (already calculated in frontend if needed)
        const hash = `manual|${date}|${original_amount}|${description.substring(0, 30)}|${Date.now()}`;
        db.run(`INSERT INTO transactions (date, description, counterparty, entity, amount, source, hash, original_currency, original_amount) VALUES (?, ?, ?, ?, ?, 'manual', ?, ?, ?)`, 
            [date, description, counterparty, entity, amount, hash, original_currency, original_amount], 
            function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            }
        );
    });
}

function getUsers() {
    return new Promise((resolve, reject) => {
        db.all("SELECT id, email, password, role, name, phone FROM users", (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function addUser(email, password, role, name = null, phone = null) {
    return new Promise((resolve, reject) => {
        db.run("INSERT INTO users (email, password, role, name, phone) VALUES (?, ?, ?, ?, ?)", [email, password, role, name, phone], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function deleteUser(id) {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM users WHERE id = ?", [id], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

module.exports = { 
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
};

function updateUser(id, email, password, role, name = null, phone = null) {
    return new Promise((resolve, reject) => {
        const hasPassword = password && password.trim() !== '';
        const query = hasPassword 
            ? "UPDATE users SET email = ?, password = ?, role = ?, name = ?, phone = ? WHERE id = ?"
            : "UPDATE users SET email = ?, role = ?, name = ?, phone = ? WHERE id = ?";
        const params = hasPassword 
            ? [email, password, role, name, phone, id]
            : [email, role, name, phone, id];
        
        db.run(query, params, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function deleteManualTransaction(id) {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM transactions WHERE id = ? AND source = 'manual'", [id], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function clearManualTransactions() {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM transactions WHERE source = 'manual'", (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}
