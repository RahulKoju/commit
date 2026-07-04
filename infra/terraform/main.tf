module "vpc" {
  source = "./modules/vpc"

  aws_region          = var.aws_region
  project_name        = var.project_name
  environment         = var.environment
  vpc_cidr            = var.vpc_cidr
  public_subnet_cidrs = var.public_subnet_cidrs
}

module "ec2" {
  source = "./modules/ec2"

  project_name     = var.project_name
  environment      = var.environment
  instance_types   = var.instance_types
  key_name         = var.key_name
  allowed_ssh_cidr = var.allowed_ssh_cidr
  vpc_cidr         = var.vpc_cidr
  ubuntu_ami       = var.ubuntu_ami

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.public_subnet_ids
}

module "scheduler" {
  source = "./modules/scheduler"

  project_name = var.project_name
  environment  = var.environment
  instance_ids = module.ec2.instance_ids

  start_cron        = "cron(50 7 * * ? *)"
  stop_cron         = "cron(0 0 * * ? *)"
  schedule_timezone = "Asia/Kathmandu"
}