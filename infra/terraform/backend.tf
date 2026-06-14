terraform {
  backend "s3" {
    bucket  = "commit-tf-state"
    key     = "prod/terraform.tfstate"
    region  = "ap-south-1"
    encrypt = true
  }
}