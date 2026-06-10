variable "aws_region" {
  description = "AWS region for VPC resources"
  type        = string
}

variable "project_name" {
  description = "Project name used for tagging"
  type        = string
}

variable "environment" {
  description = "Environment name (dev/staging/prod)"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
}

variable "public_subnet_cidrs" {
  description = "List of public subnet CIDRs"
  type        = list(string)
}