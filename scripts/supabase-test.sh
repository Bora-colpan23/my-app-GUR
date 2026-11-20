#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# Supabase şemasını YEREL bir PostgreSQL'de sınar (gerçek proje gerekmez).
#
#   npm run supabase:test
#
# Temiz bir veritabanı kurar (GUR_TEST_DB, varsayılan gur_supabase_test),
# Supabase'in auth/storage parçalarını taklit eden kabuğu (tests/shim.sql),
# sonra migrations/*.sql + seed.sql + tests/gur.test.sql dosyalarını sırayla
# uygular. Süper kullanıcı bağlantısı ister:
#
#   GUR_TEST_PG="postgres://postgres:...@127.0.0.1:5432"   (veritabanı adı YOK)
#
# Verilmezse yerel `su postgres` yolu denenir (setup.sh ile aynı).
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

DB="${GUR_TEST_DB:-gur_supabase_test}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SB="$HERE/supabase"

if [[ -n "${GUR_TEST_PG:-}" ]]; then
  admin() { psql "$GUR_TEST_PG/postgres" -v ON_ERROR_STOP=1 -qAt -c "$1"; }
  run()   { psql "$GUR_TEST_PG/$DB" -v ON_ERROR_STOP=1 -q "$@"; }
else
  admin() { su postgres -c "psql -v ON_ERROR_STOP=1 -qAt -c \"$1\""; }
  run()   { su postgres -c "psql -d $DB -v ON_ERROR_STOP=1 -q $*"; }
fi

echo "› $DB sıfırlanıyor"
admin "drop database if exists $DB with (force)"
admin "create database $DB"

echo "› Supabase kabuğu"
run -f "$SB/tests/shim.sql"

for f in "$SB"/migrations/*.sql; do
  echo "› migration $(basename "$f")"
  run -f "$f"
done

echo "› seed"
run -f "$SB/seed.sql"

echo "› testler"
run -f "$SB/tests/gur.test.sql"
echo "✓ Supabase şeması geçti"
