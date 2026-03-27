#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p backups
cp database/database.sqlite backups/backup_$DATE.sqlite
# Удаляем старые бэкапы (старше 30 дней)
find backups -name "*.sqlite" -mtime +30 -delete