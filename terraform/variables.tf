variable "project_name" {
  description = "Project identifier used in resource names and tags"
  type        = string
  default     = "lobster"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "prod"
}

variable "aws_region" {
  description = "AWS region for the S3 bucket"
  type        = string
  default     = "us-east-1"
}

variable "parent_domain" {
  description = "Existing Route53 hosted zone the site lives under"
  type        = string
  default     = "18thcenturymaterialculture.org"
}

variable "subdomain" {
  description = "Subdomain of parent_domain to serve the site at"
  type        = string
  default     = "lobster"
}

variable "price_class" {
  description = "CloudFront price class"
  type        = string
  default     = "PriceClass_100" # US, Canada, Europe
}

variable "github_repo" {
  description = "GitHub repo in owner/name form, used to scope the OIDC deploy role's trust policy"
  type        = string
  default     = "vonschtirlitz/lobster"
}
