# ─────────────────────────────────────────────
# IAM role for EC2 nodes
# Grants EBS CSI driver permission to manage volumes
# ─────────────────────────────────────────────

resource "aws_iam_role" "node" {
  name = "${var.project_name}-${var.environment}-node-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-${var.environment}-node-role"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# EBS CSI policy — scoped to only what the driver needs
resource "aws_iam_role_policy" "ebs_csi" {
  name = "${var.project_name}-${var.environment}-ebs-csi-policy"
  role = aws_iam_role.node.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ec2:CreateVolume",
          "ec2:DeleteVolume",
          "ec2:AttachVolume",
          "ec2:DetachVolume",
          "ec2:ModifyVolume",
          "ec2:DescribeVolumes",
          "ec2:DescribeVolumeStatus",
          "ec2:DescribeInstances",
          "ec2:DescribeAvailabilityZones",
          "ec2:DescribeTags",
          "ec2:CreateTags",
          "ec2:CreateSnapshot",
          "ec2:DeleteSnapshot",
          "ec2:DescribeSnapshots"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_instance_profile" "node" {
  name = "${var.project_name}-${var.environment}-node-profile"
  role = aws_iam_role.node.name

  tags = {
    Name        = "${var.project_name}-${var.environment}-node-profile"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
