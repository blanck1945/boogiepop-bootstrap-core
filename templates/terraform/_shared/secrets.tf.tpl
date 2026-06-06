resource "aws_secretsmanager_secret" "{{TF_NAME}}" {
  count                   = local.{{TF_NAME}}_ecs_ready ? 1 : 0
  name                    = "${local.name}-{{APP_NAME}}-secrets"
  description             = "Variables de entorno para boogiepop-{{APP_NAME}}."
  recovery_window_in_days = 7

  tags = { Name = "${local.name}-{{APP_NAME}}-secrets", App = "{{APP_NAME}}" }
}

resource "aws_secretsmanager_secret_version" "{{TF_NAME}}" {
  count     = local.{{TF_NAME}}_ecs_ready ? 1 : 0
  secret_id = aws_secretsmanager_secret.{{TF_NAME}}[0].id

  secret_string = jsonencode(var.{{TF_NAME}}_app_env)
}

resource "aws_iam_role_policy" "ecs_execution_{{TF_NAME}}_secret" {
  count = local.{{TF_NAME}}_ecs_ready ? 1 : 0
  name  = "${local.name}-exec-{{APP_NAME}}-secret"
  role  = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "GetAppEnvSecret"
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = aws_secretsmanager_secret.{{TF_NAME}}[0].arn
    }]
  })
}
