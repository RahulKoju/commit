variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "instance_ids" {
  description = "List of EC2 instance IDs: [0]=control-plane, [1]=worker"
  type        = list(string)
}

variable "start_cron" {
  description = "AWS Scheduler cron expression to start the cluster"
  type        = string
  default     = "cron(50 7 * * ? *)"
}

variable "stop_cron" {
  description = "AWS Scheduler cron expression to stop the cluster"
  type        = string
  default     = "cron(0 0 * * ? *)"
}

variable "schedule_timezone" {
  description = "IANA timezone for schedule evaluation"
  type        = string
  default     = "Asia/Kathmandu"
}