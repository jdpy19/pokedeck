#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TERRAFORM_DIR="${TERRAFORM_DIR:-$PROJECT_DIR/terraform}"
DIST_DIR="${DIST_DIR:-$PROJECT_DIR/dist}"
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-2}}"

command -v aws >/dev/null 2>&1 || {
  echo "aws CLI is required but was not found in PATH." >&2
  exit 1
}

command -v npm >/dev/null 2>&1 || {
  echo "npm is required but was not found in PATH." >&2
  exit 1
}

terraform_output() {
  local name="$1"

  if command -v terraform >/dev/null 2>&1 && [ -d "$TERRAFORM_DIR/.terraform" ]; then
    terraform -chdir="$TERRAFORM_DIR" output -raw "$name" 2>/dev/null || true
  fi
}

BUCKET="${BUCKET:-${S3_BUCKET:-$(terraform_output bucket_name)}}"
CLOUDFRONT_DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID:-$(terraform_output cloudfront_distribution_id)}"
SITE_URL="$(terraform_output site_url)"

if [ -z "$BUCKET" ]; then
  echo "No deployment bucket found. Run Terraform first or set BUCKET." >&2
  exit 1
fi

cd "$PROJECT_DIR"

echo "Building and testing static site..."
npm run build

if [ ! -d "$DIST_DIR" ]; then
  echo "Build output directory '$DIST_DIR' was not found." >&2
  exit 1
fi

echo "Deploying static assets to s3://$BUCKET in $REGION..."
aws s3 sync "$DIST_DIR/" "s3://$BUCKET/" \
  --region "$REGION" \
  --delete \
  --exclude "index.html" \
  --cache-control "public,max-age=3600,must-revalidate"

aws s3 cp "$DIST_DIR/index.html" "s3://$BUCKET/index.html" \
  --region "$REGION" \
  --content-type "text/html; charset=utf-8" \
  --cache-control "no-cache,no-store,must-revalidate"

if [ -n "$CLOUDFRONT_DISTRIBUTION_ID" ]; then
  echo "Invalidating CloudFront distribution $CLOUDFRONT_DISTRIBUTION_ID..."
  aws cloudfront create-invalidation \
    --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
    --paths "/*"
else
  echo "Skipping CloudFront invalidation: no distribution ID was found."
fi

echo "Deploy complete${SITE_URL:+: $SITE_URL}"
