output "bucket_name" {
  description = "Private S3 bucket receiving the static build."
  value       = aws_s3_bucket.site.id
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution invalidated after deployment."
  value       = aws_cloudfront_distribution.site.id
}

output "cloudfront_domain_name" {
  description = "CloudFront hostname for diagnostics."
  value       = aws_cloudfront_distribution.site.domain_name
}

output "site_url" {
  description = "Canonical public URL."
  value       = "https://${var.domain_name}"
}
