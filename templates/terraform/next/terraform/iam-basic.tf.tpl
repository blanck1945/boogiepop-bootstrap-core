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
