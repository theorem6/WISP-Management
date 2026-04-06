#!/bin/bash
# Force clear old update commands with wrong hashes
# Requires MONGODB_URI (same as backend .env). Never embed credentials in this script.

set -euo pipefail

EPC_ID="${1:-EPC-CB4C5042}"

if [ -z "${MONGODB_URI:-}" ]; then
  echo "Error: set MONGODB_URI to your MongoDB connection string (e.g. export from .env in this directory)."
  exit 1
fi

echo "Force clearing old update commands for EPC: $EPC_ID"

mongosh "$MONGODB_URI" --quiet <<EOF
db.epccommands.deleteMany({
  epc_id: "$EPC_ID",
  command_type: "script_execution",
  script_content: { \$regex: "Auto-generated update script" }
});

print("Commands cleared. Check the result above.");
EOF

echo "Done. Next check-in will generate new commands with correct hashes."
