resource "aws_security_group" "ec2" {
  name = "${var.project_name}-${var.environment}-sg"
  description = "Security group for EC2 instances"
  vpc_id = var.vpc_id

   tags = {
    Name = "${var.project_name}-${var.environment}-sg"
  }
}

resource "aws_vpc_security_group_ingress_rule" "ssh" {
    security_group_id = aws_security_group.ec2.id

    ip_protocol = "tcp"

    from_port = 22
    to_port = 22

    cidr_ipv4 = var.allowed_ssh_cidr

    description = "SSH"
}

resource "aws_vpc_security_group_ingress_rule" "http" {
    security_group_id = aws_security_group.ec2.id

    ip_protocol = "tcp"

    from_port = 80
    to_port = 80

    cidr_ipv4 = "0.0.0.0/0"

    description = "HTTP"
}

resource "aws_vpc_security_group_ingress_rule" "https" {
    security_group_id = aws_security_group.ec2.id

    ip_protocol = "tcp"

    from_port = 443
    to_port = 443

    cidr_ipv4 = "0.0.0.0/0"

    description = "HTTPS"
}

resource "aws_vpc_security_group_ingress_rule" "k8s_api" {
    security_group_id = aws_security_group.ec2.id

    ip_protocol = "tcp"

    from_port = 6443
    to_port = 6443

    cidr_ipv4 = var.allowed_ssh_cidr

    description = "Kubernetes API"
}

# resource "aws_vpc_security_group_ingress_rule" "rke" {
#     security_group_id = aws_security_group.ec2.id

#     ip_protocol = "tcp"

#     from_port = 9345
#     to_port = 9345

#     referenced_security_group_id = aws_security_group.ec2.id

#     description = "RKE node communication"
# }

# resource "aws_vpc_security_group_ingress_rule" "etcd" {
#   security_group_id            = aws_security_group.ec2.id
#   ip_protocol                  = "tcp"
#   from_port                    = 2379
#   to_port                      = 2380
#   referenced_security_group_id = aws_security_group.ec2.id
#   description                  = "etcd server client API"
# }

# resource "aws_vpc_security_group_ingress_rule" "etcd_vpc" {
#   security_group_id = aws_security_group.ec2.id
#   ip_protocol       = "tcp"
#   from_port         = 2379
#   to_port           = 2380
#   cidr_ipv4         = var.vpc_cidr
#   description       = "etcd from VPC"
# }

# resource "aws_vpc_security_group_ingress_rule" "kubelet" {
#   security_group_id            = aws_security_group.ec2.id
#   ip_protocol                  = "tcp"
#   from_port                    = 10250
#   to_port                      = 10250
#   referenced_security_group_id = aws_security_group.ec2.id
#   description                  = "Kubelet API"
# }

# resource "aws_vpc_security_group_ingress_rule" "canal" {
#   security_group_id            = aws_security_group.ec2.id
#   ip_protocol                  = "udp"
#   from_port                    = 8472
#   to_port                      = 8472
#   referenced_security_group_id = aws_security_group.ec2.id
#   description                  = "Canal CNI VXLAN"
# }

resource "aws_vpc_security_group_ingress_rule" "internal" {
  security_group_id = aws_security_group.ec2.id
  ip_protocol       = "-1"
  cidr_ipv4         = var.vpc_cidr
  description       = "Allow all internal VPC traffic"
}

resource "aws_vpc_security_group_egress_rule" "all" {
    security_group_id = aws_security_group.ec2.id

    ip_protocol = "-1"

    cidr_ipv4 = "0.0.0.0/0"

    description = "Allow all outbound traffic"
}

data "aws_ami" "ubuntu" {
  most_recent      = true

  owners = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_instance" "node" {
  count = 2

  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_types[count.index]
  key_name = var.key_name

  subnet_id = var.subnet_ids[count.index]
  vpc_security_group_ids = [aws_security_group.ec2.id]

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
  }

  tags = {
    Name = count.index == 0 ? "${var.project_name}-${var.environment}-control-plane" : "${var.project_name}-${var.environment}-worker"
    Role = count.index == 0 ? "control-plane" : "worker"

    Project = var.project_name
    Environment = var.environment
  }
}

resource "aws_eip" "node" {
  count = 2 
    
  instance = aws_instance.node[count.index].id

  tags = {
    Name = count.index == 0 ? "${var.project_name}-${var.environment}-control-plane-eip" : "${var.project_name}-${var.environment}-worker-eip"

    Project = var.project_name
    Environment = var.environment
  }
}