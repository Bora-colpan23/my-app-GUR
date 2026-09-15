#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# Veritabanını sıfırdan kurar.
#
#   ./server/db/setup.sh            # gur veritabanını oluşturur
#   ./server/db/setup.sh --reset    # varsa düşürüp yeniden kurar
#
# Eklentiler (earthdistance, cube, pgcrypto, citext) süper kullanıcı ister;
# bu yüzden önce postgres olarak kuruluyor, şema sonra uygulama rolüyle
# çalıştırılıyor. Uygulama rolü hiçbir zaman süper kullanıcı olmuyor.
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

DB="${GUR_DB:-gur}"
ROLE="${GUR_DB_USER:-gur}"
PASS="${GUR_DB_PASSWORD:-gur_dev}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

as_postgres() { su postgres -c "$1"; }

if [[ "${1:-}" == "--reset" ]]; then
  echo "› $DB düşürülüyor"
  as_postgres "dropdb --if-exists $DB"
fi

if ! as_postgres "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='$ROLE'\"" | grep -q 1; then
  echo "› rol oluşturuluyor: $ROLE"
  as_postgres "psql -c \"CREATE ROLE $ROLE LOGIN PASSWORD '$PASS';\""
fi

if ! as_postgres "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='$DB'\"" | grep -q 1; then
  echo "› veritabanı oluşturuluyor: $DB"
  as_postgres "createdb -O $ROLE $DB"
fi

echo "› eklentiler kuruluyor (süper kullanıcı)"
as_postgres "psql -d $DB -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto;
                             CREATE EXTENSION IF NOT EXISTS citext;
                             CREATE EXTENSION IF NOT EXISTS cube;
                             CREATE EXTENSION IF NOT EXISTS earthdistance;'" >/dev/null

echo "› şema uygulanıyor"
PGPASSWORD="$PASS" psql -h 127.0.0.1 -U "$ROLE" -d "$DB" -v ON_ERROR_STOP=1 -q -f "$HERE/schema.sql"

echo "✓ hazır — DATABASE_URL=postgres://$ROLE:$PASS@127.0.0.1:5432/$DB"
