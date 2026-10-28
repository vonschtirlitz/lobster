output "site_url" {
  description = "Live site URL"
  value       = "https://${local.site_domain}"
}

output "cloudfront_url" {
  description = "CloudFront distribution URL"
  value       = "https://${aws_cloudfront_distribution.site.domain_name}"
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (GitHub variable CF_DISTRIBUTION_ID)"
  value       = aws_cloudfront_distribution.site.id
}

output "s3_bucket_name" {
  description = "S3 bucket name (GitHub variable S3_BUCKET)"
  value       = aws_s3_bucket.site.id
}

output "deploy_role_arn" {
  description = "Role the deploy workflow assumes (GitHub variable AWS_DEPLOY_ROLE_ARN)"
  value       = aws_iam_role.deploy.arn
}
