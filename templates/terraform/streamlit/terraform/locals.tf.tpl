locals {
  {{TF_NAME}}_http_path = trim(trimspace(var.{{TF_NAME}}_http_path), "/")

  {{TF_NAME}}_ecs_http_ready = (
    var.enable_{{TF_NAME}}_ecs &&
    var.enable_frontend_ecs &&
    !var.enable_https
  )

  {{TF_NAME}}_ecs_https_ready = (
    var.enable_{{TF_NAME}}_ecs &&
    var.enable_frontend_ecs &&
    var.enable_https
  )

  # ecs_ready: ECR + ECS + S3 siempre activos cuando el servicio está habilitado
  {{TF_NAME}}_ecs_ready = var.enable_{{TF_NAME}}_ecs && var.enable_frontend_ecs

  {{TF_NAME}}_image_tag = var.{{TF_NAME}}_docker_image_tag

  {{TF_NAME}}_base_path = "/${local.{{TF_NAME}}_http_path}"

  {{TF_NAME}}_health_check_path = "${local.{{TF_NAME}}_base_path}/_stcore/health"

  {{TF_NAME}}_http_embed_url = local.{{TF_NAME}}_ecs_http_ready ? "http://${aws_lb.main.dns_name}${local.{{TF_NAME}}_base_path}/?embed=true" : null

  {{TF_NAME}}_https_embed_url = local.{{TF_NAME}}_ecs_https_ready ? "https://${trimspace(coalesce(var.frontend_{{TF_NAME}}_domain, var.frontend_host_domain))}${local.{{TF_NAME}}_base_path}/?embed=true" : null

  {{TF_NAME}}_bucket_name = local.{{TF_NAME}}_ecs_ready ? "${var.project_name}-{{APP_NAME}}-${data.aws_caller_identity.current.account_id}" : ""

  {{TF_NAME}}_secret_keys = keys(var.{{TF_NAME}}_app_env)
  {{TF_NAME}}_ecs_secrets = local.{{TF_NAME}}_ecs_ready ? [
    for k in local.{{TF_NAME}}_secret_keys : {
      name      = k
      valueFrom = "${aws_secretsmanager_secret.{{TF_NAME}}[0].arn}:${k}::"
    }
  ] : []
}
