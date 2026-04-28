#!/bin/bash
while IFS='=' read -r key value || [ -n "$key" ]; do
  # Ignore empty lines and comments
  if [[ -z "$key" ]] || [[ "$key" =~ ^# ]]; then
    continue
  fi
  # Trim quotes/whitespace
  key=$(echo "$key" | xargs)
  value=$(echo "$value" | xargs)
  echo "Adding $key..."
  npx vercel env add "$key" production preview development --value "$value" --yes
done < .env
