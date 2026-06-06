variable "enable_{{TF_NAME}}_ecs" {
  description = "true: despliega ECS + ALB para boogiepop-{{APP_NAME}} (requiere enable_frontend_ecs). Path HTTP: /{{HTTP_PATH}}."
  type        = bool
  default     = false
}

variable "{{TF_NAME}}_http_path" {
  description = "Prefijo ALB HTTP para {{APP_NAME}}. Ej. {{HTTP_PATH}}  http://<alb>/{{HTTP_PATH}}/"
  type        = string
  default     = "{{HTTP_PATH}}"
}

variable "{{TF_NAME}}_container_port" {
  description = "Puerto de la app {{APP_NAME}} en el contenedor (Streamlit default 8501)."
  type        = number
  default     = 8501
}

variable "{{TF_NAME}}_desired_count" {
  description = "Tasks Fargate {{APP_NAME}} paralelas."
  type        = number
  default     = 1
}

variable "{{TF_NAME}}_task_cpu" {
  description = "CPU Fargate {{APP_NAME}} (Linux/ARM). 512 = 0.5 vCPU."
  type        = number
  default     = 512
}

variable "{{TF_NAME}}_task_memory" {
  description = "Memoria MiB task Fargate {{APP_NAME}}."
  type        = number
  default     = 1024
}

variable "{{TF_NAME}}_docker_image_tag" {
  description = "Tag ECR {{APP_NAME}}. CI en main publica :latest."
  type        = string
  default     = "latest"
}

variable "{{TF_NAME}}_container_image" {
  description = "Imagen ECS {{APP_NAME}} completa; null construye desde ECR <project>-{{APP_NAME}}."
  type        = string
  nullable    = true
  default     = null
}

variable "frontend_{{TF_NAME}}_domain" {
  description = "FQDN público {{APP_NAME}} en modo HTTPS. Null usa frontend_host_domain (p. ej. boogiepop.cloud)."
  type        = string
  nullable    = true
  default     = null
}

variable "{{TF_NAME}}_app_env" {
  description = "Variables de entorno (Secrets Manager) para boogiepop-{{APP_NAME}}. Claves = nombres de env en el contenedor."
  type        = map(string)
  sensitive   = true
  default     = {}
}
