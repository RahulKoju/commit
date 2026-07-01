variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Project name for tagging"
  type        = string
  default     = "commit"
}

variable "environment" {
  description = "Deployment environment (dev/staging/prod)"
  type        = string
  default     = "production"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "Public subnet CIDRs"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "instance_types" {
  description = "EC2 instance types, indexed by node: [0]=control-plane, [1]=worker"
  type        = list(string)
  default     = ["t3.small", "c7i-flex.large"]
}

variable "key_name" {
  description = "SSH key pair name"
  type        = string
}

variable "allowed_ssh_cidr" {
  description = "Allowed SSH CIDR"
  type        = string
}