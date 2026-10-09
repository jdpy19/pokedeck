# Crystal 151

A dependency-free, single-page Pokédex for the original 151 Pokémon, deployed as static assets through S3 and CloudFront.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the data flow, filter contract, caching model, security boundaries, and infrastructure decisions.

## Development

Requires Node 22.13+ for the dependency-free TypeScript build and Python 3 only for the convenience preview command.

```sh
asdf install
npm test
```

Run the local static preview:

```sh
npm run build
npm run preview
```

Then open `http://localhost:4173`.

## Build and test

```sh
npm run build
npm test
npm run check
npm run format:check
```

The dependency-free build uses Node’s built-in TypeScript type stripper and copies browser assets into `dist/`. `npm run build` checks JavaScript syntax and runs the complete test suite after generating the deployment artifact.

`npm run format:check` verifies all Terraform files recursively and prints a diff when formatting is incorrect. Provisioning runs the same check before validation or planning.

## Provision S3 and CloudFront

Terraform state is local by default. The public Route 53 hosted zone must already exist, and the AWS CLI must be authenticated to the target account.

Copy the example variables and choose the public hostname:

```sh
cp terraform/terraform.tfvars.example terraform/terraform.tfvars
npm run provision:plan
npm run provision
```

`provision:plan` initializes and validates Terraform, checks the current AWS identity, and produces a read-only plan. `provision` saves a plan and asks before applying that exact plan; set `AUTO_APPROVE=true` only for controlled automation.

## Deploy

After provisioning, the deployment script reads the bucket and distribution identifiers from Terraform, validates/tests the app, syncs static assets, applies a non-cacheable policy to `index.html`, and invalidates CloudFront:

```sh
npm run deploy
```

For existing infrastructure, override discovery with `BUCKET`, `AWS_REGION`, and optionally `CLOUDFRONT_DISTRIBUTION_ID`. The script uses `aws s3 sync --delete`, so its bucket must be dedicated to this application. It never stores AWS credentials.

## Tests

`npm test` covers nested boolean expressions, every comparison operator, missing and null behavior, unsupported and malformed contracts, depth enforcement, malicious field/operator rejection, network success, offline cache fallback, invalid API response handling, stable cache keys, and corrupt `localStorage` recovery.
