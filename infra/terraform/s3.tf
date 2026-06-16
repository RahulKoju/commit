# ─────────────────────────────────────────────
# S3 bucket for Loki log storage
# ─────────────────────────────────────────────

resource "aws_s3_bucket" "loki_logs" {
  bucket = "commit-loki-logs-${var.environment}"

  tags = {
    Name        = "commit-loki-logs"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_s3_bucket_versioning" "loki_logs" {
  bucket = aws_s3_bucket.loki_logs.id

  versioning_configuration {
    status = "Disabled" # logs don't need versioning
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "loki_logs" {
  bucket = aws_s3_bucket.loki_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "loki_logs" {
  bucket = aws_s3_bucket.loki_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# 7-day lifecycle rule — matches Loki retention (168h)
resource "aws_s3_bucket_lifecycle_configuration" "loki_logs" {
  bucket = aws_s3_bucket.loki_logs.id

  rule {
    id     = "loki-log-retention"
    status = "Enabled"

    filter {}

    expiration {
      days = 7
    }

    # also clean up incomplete multipart uploads
    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

# ─────────────────────────────────────────────
# IAM user scoped to this bucket only
# ─────────────────────────────────────────────

resource "aws_iam_user" "loki" {
  name = "commit-loki-${var.environment}"

  tags = {
    Name        = "commit-loki"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_iam_access_key" "loki" {
  user = aws_iam_user.loki.name
}

resource "aws_iam_user_policy" "loki_s3" {
  name = "commit-loki-s3-policy"
  user = aws_iam_user.loki.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket",
          "s3:GetBucketLocation"
        ]
        Resource = [
          aws_s3_bucket.loki_logs.arn,
          "${aws_s3_bucket.loki_logs.arn}/*"
        ]
      }
    ]
  })
}

# ─────────────────────────────────────────────
# Outputs — used to populate loki-s3-secret.yaml
# ─────────────────────────────────────────────

output "loki_s3_bucket_name" {
  value       = aws_s3_bucket.loki_logs.bucket
  description = "S3 bucket name for Loki — put in loki-s3-secret.yaml"
}

output "loki_iam_access_key_id" {
  value       = aws_iam_access_key.loki.id
  description = "IAM access key ID for Loki — put in loki-s3-secret.yaml"
}

output "loki_iam_secret_access_key" {
  value       = aws_iam_access_key.loki.secret
  sensitive   = true
  description = "IAM secret access key for Loki — run: terraform output -raw loki_iam_secret_access_key"
}
