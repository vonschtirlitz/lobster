# Short-lived OIDC credentials for the deploy workflow; the provider belongs to the material-culture stack.

data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

# Trust restricted to runs on main of this repo only.
data "aws_iam_policy_document" "deploy_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["${var.github_oidc_subject_prefix}:ref:refs/heads/main"]
    }
  }
}

# gh-actions-* is the prefix the material-culture terraform-apply role may manage.
resource "aws_iam_role" "deploy" {
  name               = "gh-actions-${var.project_name}-deploy"
  assume_role_policy = data.aws_iam_policy_document.deploy_trust.json
}

# Write access scoped to exactly this site's bucket and distribution.
data "aws_iam_policy_document" "deploy_permissions" {
  statement {
    sid       = "SyncSiteBucket"
    effect    = "Allow"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.site.arn]
  }

  statement {
    sid       = "WriteSiteBucketObjects"
    effect    = "Allow"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.site.arn}/*"]
  }

  statement {
    sid       = "InvalidateSiteDistribution"
    effect    = "Allow"
    actions   = ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation", "cloudfront:GetDistribution"]
    resources = [aws_cloudfront_distribution.site.arn]
  }
}

resource "aws_iam_role_policy" "deploy" {
  name   = "deploy-permissions"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy_permissions.json
}
