#!/bin/sh
# Nightly copy of Realm's database: 7 days kept on this server (~/backups) and 7 in R2 (one slot
# per weekday under backups/db/, in the private EU bucket). Installed in the ubuntu user's cron:
#
#   30 3 * * * /home/ubuntu/realm/infra/beta/backup-db.sh >> /home/ubuntu/backups/backup.log 2>&1
#
# Restore steps: docs/BETA-SERVER.md, "Database backups".
set -eu
cd "$(dirname "$0")"
compose() { docker compose -f docker-compose.yml "$@"; }

DIR="$HOME/backups"
mkdir -p "$DIR"
chmod 700 "$DIR"
FILE="$DIR/realm-$(date -u +%Y-%m-%d).dump"

# Compressed custom format: pg_restore can bring back everything or a single table.
compose exec -T postgres pg_dump -U realm -d realm --format=custom --no-owner >"$FILE.part"
mv "$FILE.part" "$FILE"
chmod 600 "$FILE"

DAY=$(date -u +%a | tr '[:upper:]' '[:lower:]')
compose exec -T api node backend/api/node_modules/tsx/dist/cli.mjs \
  backend/api/scripts/upload-backup.ts "backups/db/realm-$DAY.dump" <"$FILE"

find "$DIR" -name 'realm-*.dump' -mtime +7 -delete
echo "$(date -u +%FT%TZ) backup ok: $(wc -c <"$FILE") bytes"
