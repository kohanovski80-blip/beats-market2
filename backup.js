// backup.js
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const backupDir = path.join(__dirname, 'backups');
const dbPath = path.join(__dirname, 'database', 'database.sqlite');

if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
}

const date = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
const backupPath = path.join(backupDir, `backup_${date}.sqlite`);

fs.copyFileSync(dbPath, backupPath);
console.log(`✅ Backup created: ${backupPath}`);

// Delete backups older than 30 days
const files = fs.readdirSync(backupDir);
files.forEach(file => {
    const filePath = path.join(backupDir, file);
    const stats = fs.statSync(filePath);
    const daysOld = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);
    if (daysOld > 30) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ Deleted old backup: ${file}`);
    }
});