resource "aws_s3_bucket" "{{TF_NAME}}" {
  count  = local.{{TF_NAME}}_ecs_ready ? 1 : 0
  bucket = "${var.project_name}-{{APP_NAME}}-${data.aws_caller_identity.current.account_id}"

  tags = { Name = "${local.name}-{{APP_NAME}}", App = "{{APP_NAME}}" }
}

resource "aws_s3_bucket_versioning" "{{TF_NAME}}" {
  count  = local.{{TF_NAME}}_ecs_ready ? 1 : 0
  bucket = aws_s3_bucket.{{TF_NAME}}[0].id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "{{TF_NAME}}" {
  count  = local.{{TF_NAME}}_ecs_ready ? 1 : 0
  bucket = aws_s3_bucket.{{TF_NAME}}[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "{{TF_NAME}}" {
  count  = local.{{TF_NAME}}_ecs_ready ? 1 : 0
  bucket = aws_s3_bucket.{{TF_NAME}}[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Permite que el browser suba/baje archivos directo a S3 vía URLs presignadas
# emitidas por el API central (módulo storage). El límite de seguridad es la
# firma + expiración de la URL presignada (y el scoping IAM), no el origen —
# por eso "*" es seguro acá: sin una presigned URL válida, S3 igual rechaza.
resource "aws_s3_bucket_cors_configuration" "{{TF_NAME}}" {
  count  = local.{{TF_NAME}}_ecs_ready ? 1 : 0
  bucket = aws_s3_bucket.{{TF_NAME}}[0].id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 300
  }
}
