output "vpc_id" {
  value       = aws_vpc.main.id
  description = "VPC ID"
}

output "public_subnet_ids" {
  value       = aws_subnet.public[*].id
  description = "Public subnet IDs"
}

output "igw_id" {
  value       = aws_internet_gateway.igw.id
  description = "Internet Gateway ID"
}