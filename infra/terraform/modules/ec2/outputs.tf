output "instance_ids" {
  value       = aws_instance.node[*].id
  description = "EC2 instance IDs"
}

output "public_ips" {
  value       = aws_eip.node[*].public_ip
  description = "Elastic IPs addresses for all nodes"
}

output "security_group_id" {
  value       = aws_security_group.ec2.id
  description = "Security group ID for EC2 instances"
}

output "control_plane_ip" {
  value       = aws_eip.node[0].public_ip
  description = "Public IP of control plane node"
}

output "worker_ip" {
  value       = aws_eip.node[1].public_ip
  description = "Public IP of worker node"
}