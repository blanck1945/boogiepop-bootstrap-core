resource "aws_iam_role" "{{TF_NAME}}_task" {
  count = local.{{TF_NAME}}_ecs_ready ? 1 : 0
  name  = "${local.name}-{{APP_NAME}}-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = { Name = "${local.name}-{{APP_NAME}}-task" }
}

resource "aws_iam_role_policy" "{{TF_NAME}}_s3" {
  count = local.{{TF_NAME}}_ecs_ready ? 1 : 0
  name  = "${local.name}-{{APP_NAME}}-s3"
  role  = aws_iam_role.{{TF_NAME}}_task[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ListBucket"
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = aws_s3_bucket.{{TF_NAME}}[0].arn
      },
      {
        Sid    = "ReadWriteObjects"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_bucket.{{TF_NAME}}[0].arn}/*"
      }
    ]
  })
}
