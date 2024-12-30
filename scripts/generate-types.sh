#!/bin/bash

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '#' | sed 's/\r$//' | awk '/=/ {print $1}')
fi

# Login to Supabase
echo "Logging in to Supabase..."
npx supabase login "$SUPABASE_ACCESS_TOKEN"

# Generate types
echo "Generating types..."
npx supabase gen types typescript --project-id "$PROJECT_ID" > app/types/database.ts

echo "Types generated successfully!" 