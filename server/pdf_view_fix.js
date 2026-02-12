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
