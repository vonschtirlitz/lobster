.PHONY: help infra-init infra-plan infra-apply infra-destroy github-vars deploy

TF := cd terraform && terraform

help:
	@echo ""
	@echo "LOBSTER make targets:"
	@echo ""
	@echo "  infra-init     terraform init"
	@echo "  infra-plan     terraform plan"
	@echo "  infra-apply    terraform apply (creates the AWS resources)"
	@echo "  infra-destroy  terraform destroy (takes the site down)"
	@echo "  github-vars    copy terraform outputs into the GitHub repo's Actions variables"
	@echo "  deploy         build and upload from this machine (normally CI does this on push to main)"
	@echo ""

infra-init:
	$(TF) init

infra-plan:
	$(TF) plan

infra-apply:
	$(TF) apply

infra-destroy:
	$(TF) destroy

# Non-secret identifiers only: the workflow authenticates with OIDC, not keys.
github-vars:
	gh variable set AWS_DEPLOY_ROLE_ARN --body "$$(cd terraform && terraform output -raw deploy_role_arn)"
	gh variable set S3_BUCKET --body "$$(cd terraform && terraform output -raw s3_bucket_name)"
	gh variable set CF_DISTRIBUTION_ID --body "$$(cd terraform && terraform output -raw cloudfront_distribution_id)"
	gh variable set SITE_URL --body "$$(cd terraform && terraform output -raw site_url)"

deploy:
	npm ci
	npm test
	npm run build
	BUCKET=$$(cd terraform && terraform output -raw s3_bucket_name); \
	DIST=$$(cd terraform && terraform output -raw cloudfront_distribution_id); \
	aws s3 sync dist/assets/ "s3://$$BUCKET/assets/" --cache-control "public, max-age=31536000, immutable" && \
	aws s3 sync dist/ "s3://$$BUCKET/" --exclude "assets/*" --cache-control "no-cache" && \
	aws s3 sync dist/ "s3://$$BUCKET/" --delete --size-only && \
	aws cloudfront create-invalidation --distribution-id "$$DIST" --paths "/index.html" "/" "/favicon.svg"
