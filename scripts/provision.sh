#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TERRAFORM_DIR="${TERRAFORM_DIR:-$PROJECT_DIR/terraform}"
MODE="${1:-apply}"

case "$MODE" in
  plan | apply) ;;
  *)
    echo "Usage: $0 [plan|apply]" >&2
    exit 2
    ;;
esac

command -v terraform >/dev/null 2>&1 || {
  echo "terraform is required but was not found in PATH." >&2
  exit 1
}

command -v aws >/dev/null 2>&1 || {
  echo "aws CLI is required but was not found in PATH." >&2
  exit 1
}

if [ ! -d "$TERRAFORM_DIR" ]; then
  echo "Terraform directory '$TERRAFORM_DIR' was not found." >&2
  exit 1
fi

echo "Using AWS identity:"
AWS_PAGER="" aws sts get-caller-identity --output table

echo "Initializing Terraform..."
terraform -chdir="$TERRAFORM_DIR" init -input=false

echo "Checking Terraform configuration..."
terraform -chdir="$TERRAFORM_DIR" fmt -check -recursive -diff
terraform -chdir="$TERRAFORM_DIR" validate

if [ "$MODE" = "plan" ]; then
  terraform -chdir="$TERRAFORM_DIR" plan
  exit 0
fi

PLAN_FILE="$(mktemp "${TMPDIR:-/tmp}/crystal-151-terraform.XXXXXX.tfplan")"
trap 'rm -f "$PLAN_FILE"' EXIT

echo "Creating Terraform plan..."
terraform -chdir="$TERRAFORM_DIR" plan -out="$PLAN_FILE"

if [ "${AUTO_APPROVE:-false}" != "true" ]; then
  if [ ! -t 0 ]; then
    echo "Apply requires an interactive terminal or AUTO_APPROVE=true." >&2
    exit 1
  fi

  read -r -p "Apply this Terraform plan? [y/N] " CONFIRM
  case "$CONFIRM" in
    y | Y | yes | YES) ;;
    *)
      echo "Provisioning cancelled."
      exit 0
      ;;
  esac
fi

echo "Applying the reviewed Terraform plan..."
terraform -chdir="$TERRAFORM_DIR" apply "$PLAN_FILE"

echo "Infrastructure provisioned. Terraform outputs:"
terraform -chdir="$TERRAFORM_DIR" output
