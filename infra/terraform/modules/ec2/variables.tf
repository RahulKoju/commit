variable "project_name" {
  description = "Project name for tagging"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "instance_types" {
  description = "EC2 instance types, indexed by node: [0]=control-plane, [1]=worker"
  type        = list(string)
}

variable "key_name" {
  description = "SSH key pair name"
  type        = string
}

variable "allowed_ssh_cidr" {
  description = "Allowed SSH CIDR"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs"
  type        = list(string)
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
}
