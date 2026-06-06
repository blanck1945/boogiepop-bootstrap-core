resource "aws_lb_target_group" "{{TF_NAME}}" {
  count = local.{{TF_NAME}}_ecs_ready ? 1 : 0

  name_prefix = "{{TG_NAME_PREFIX}}"
  port        = var.{{TF_NAME}}_container_port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = local.{{TF_NAME}}_health_check_path
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }

  lifecycle {
    create_before_destroy = true
  }

  tags = { Name = "${local.name}-tg-{{APP_NAME}}" }
}

resource "aws_lb_listener_rule" "http_{{TF_NAME}}" {
  count        = local.{{TF_NAME}}_ecs_http_ready ? 1 : 0
  listener_arn = aws_lb_listener.http.arn
  priority     = {{ALB_PRIORITY_HTTP}}

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.{{TF_NAME}}[0].arn
  }

  condition {
    path_pattern {
      values = ["/${local.{{TF_NAME}}_http_path}", "/${local.{{TF_NAME}}_http_path}/*"]
    }
  }
}

resource "aws_lb_listener_rule" "https_{{TF_NAME}}" {
  count        = local.{{TF_NAME}}_ecs_https_ready ? 1 : 0
  listener_arn = aws_lb_listener.https[0].arn
  priority     = {{ALB_PRIORITY_HTTPS}}

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.{{TF_NAME}}[0].arn
  }

  condition {
    host_header {
      values = [trimspace(coalesce(var.frontend_{{TF_NAME}}_domain, var.frontend_host_domain))]
    }
  }

  condition {
    path_pattern {
      values = ["/${local.{{TF_NAME}}_http_path}", "/${local.{{TF_NAME}}_http_path}/*"]
    }
  }
}
