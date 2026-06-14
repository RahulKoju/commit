output "instance_ids" {
  description = "EC2 instance IDs"
  value       = module.ec2.instance_ids
}

output "public_ips" {
  description = "All Elastic IPs for EC2 nodes"
  value       = module.ec2.public_ips
}

output "security_group_id" {
  description = "EC2 Security Group ID"
  value       = module.ec2.security_group_id
}

output "control_plane_ip" {
  description = "Control plane node public IP"
  value       = module.ec2.control_plane_ip
}

output "worker_ip" {
  description = "Worker node public IP"
  value       = module.ec2.worker_ip
}

output "control_plane_private_ip" {
  value       = module.ec2.control_plane_private_ip
  description = "Private IP of control plane node"
}

output "worker_private_ip" {
  value       = module.ec2.worker_private_ip
  description = "Private IP of worker node"
}