// monitor.js
const fs = require('fs');
const path = require('path');

function checkDiskSpace() {
    const uploadsDir = path.join(__dirname, 'public', 'uploads');
    const stats = fs.statfsSync(uploadsDir);
    const freeGB = (stats.bfree * stats.bsize) / (1024 * 1024 * 1024);
    
    if (freeGB < 1) {
        console.error(`⚠️ LOW DISK SPACE: ${freeGB.toFixed(2)}GB free`);
        // Здесь можно отправить email администратору
    }
}

function checkLogs() {
    const logFile = path.join(__dirname, 'logs', 'out.log');
    if (fs.existsSync(logFile)) {
        const stats = fs.statSync(logFile);
        const sizeMB = stats.size / (1024 * 1024);
        if (sizeMB > 100) {
            console.log(`📝 Log file is ${sizeMB.toFixed(2)}MB, rotating...`);
            fs.renameSync(logFile, `${logFile}.${Date.now()}`);
        }
    }
}

setInterval(() => {
    checkDiskSpace();
    checkLogs();
}, 60 * 60 * 1000); // Каждый час

console.log('✅ Monitoring started');