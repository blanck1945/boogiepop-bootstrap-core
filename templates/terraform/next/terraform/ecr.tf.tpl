resource "aws_ecr_repository" "{{TF_NAME}}" {
  count = local.{{TF_NAME}}_ecs_ready ? 1 : 0

  name = "{{ECR_REPO}}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = { Name = "${local.name}-ecr-{{APP_NAME}}" }
}

resource "aws_ecr_lifecycle_policy" "{{TF_NAME}}" {
  count = local.{{TF_NAME}}_ecs_ready ? 1 : 0

  repository = aws_ecr_repository.{{TF_NAME}}[0].name

  policy = jsonencode({
    rules = [{
      rulePriority = 10
      description  = "Expire untagged images after 7 days"
      selection = {
        tagStatus   = "untagged"
        countType   = "sinceImagePushed"
        countUnit   = "days"
        countNumber = 7
      }
      action = { type = "expire" }
    }]
  })
}
