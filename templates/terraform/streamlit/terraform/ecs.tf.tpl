resource "aws_cloudwatch_log_group" "{{TF_NAME}}" {
  count             = local.{{TF_NAME}}_ecs_ready ? 1 : 0
  name              = "/ecs/${local.name}-{{APP_NAME}}"
  retention_in_days = 14
}

resource "aws_ecs_task_definition" "{{TF_NAME}}" {
  count                    = local.{{TF_NAME}}_ecs_ready ? 1 : 0
  family                   = "${local.name}-{{APP_NAME}}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = tostring(var.{{TF_NAME}}_task_cpu)
  memory                   = tostring(var.{{TF_NAME}}_task_memory)
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.{{TF_NAME}}_task[0].arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  container_definitions = jsonencode([{
    name      = "{{APP_NAME}}"
    image     = coalesce(var.{{TF_NAME}}_container_image, "${aws_ecr_repository.{{TF_NAME}}[0].repository_url}:${local.{{TF_NAME}}_image_tag}")
    essential = true

    portMappings = [{
      containerPort = var.{{TF_NAME}}_container_port
      protocol      = "tcp"
    }]

    environment = [
      { name = "STREAMLIT_SERVER_PORT", value = tostring(var.{{TF_NAME}}_container_port) },
      { name = "STREAMLIT_SERVER_ADDRESS", value = "0.0.0.0" },
      { name = "STREAMLIT_SERVER_BASE_URL_PATH", value = "/${local.{{TF_NAME}}_http_path}" },
      { name = "STREAMLIT_SERVER_ENABLE_CORS", value = "false" },
      { name = "AWS_REGION", value = var.aws_region },
      { name = "APP_S3_BUCKET", value = local.{{TF_NAME}}_bucket_name },
    ]

    secrets = local.{{TF_NAME}}_ecs_secrets

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.{{TF_NAME}}[0].name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "{{APP_NAME}}"
      }
    }
  }])

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_ecs_service" "{{TF_NAME}}" {
  count           = local.{{TF_NAME}}_ecs_ready ? 1 : 0
  name            = "${local.name}-fe-{{APP_NAME}}-svc"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.{{TF_NAME}}[0].arn
  desired_count   = var.{{TF_NAME}}_desired_count
  launch_type     = "FARGATE"

  platform_version = var.fargate_platform_version

  enable_ecs_managed_tags = true
  propagate_tags          = "SERVICE"
  tags                    = { App = "{{APP_NAME}}" }

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.{{TF_NAME}}[0].arn
    container_name   = "{{APP_NAME}}"
    container_port   = var.{{TF_NAME}}_container_port
  }

  depends_on = [
    aws_lb_listener.http,
    aws_ecr_repository.{{TF_NAME}},
    aws_ecs_cluster_capacity_providers.main,
    terraform_data.https_preconditions,
  ]
}
