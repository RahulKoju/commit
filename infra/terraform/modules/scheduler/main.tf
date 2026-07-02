data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

data "archive_file" "ec2_scheduler" {
  type        = "zip"
  source_file = "${path.module}/lambda/ec2_scheduler.py"
  output_path = "${path.module}/lambda/ec2_scheduler.zip"
}

# Lambda execution role
resource "aws_iam_role" "lambda_exec" {
  name = "${var.project_name}-${var.environment}-ec2-scheduler-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "lambda_ec2_permissions" {
  name = "${var.project_name}-${var.environment}-ec2-start-stop"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "AllowStartStopSpecificInstances"
        Effect   = "Allow"
        Action   = ["ec2:StartInstances", "ec2:StopInstances"]
        Resource = [for id in var.instance_ids :
          "arn:aws:ec2:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:instance/${id}"
        ]
      },
      {
        Sid      = "AllowDescribeForWaiter"
        Effect   = "Allow"
        Action   = ["ec2:DescribeInstances", "ec2:DescribeInstanceStatus"]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "ec2_scheduler" {
  function_name    = "${var.project_name}-${var.environment}-ec2-scheduler"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "ec2_scheduler.handler"
  runtime          = "python3.12"
  timeout          = 600
  memory_size      = 128
  filename         = data.archive_file.ec2_scheduler.output_path
  source_code_hash = data.archive_file.ec2_scheduler.output_base64sha256

  environment {
    variables = {
      INSTANCE_IDS = join(",", var.instance_ids)
    }
  }
}

# Role EventBridge Scheduler assumes to invoke the Lambda
resource "aws_iam_role" "scheduler_invocation" {
  name = "${var.project_name}-${var.environment}-scheduler-invoke-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "scheduler.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "scheduler_invoke_lambda" {
  name = "${var.project_name}-${var.environment}-invoke-lambda"
  role = aws_iam_role.scheduler_invocation.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "lambda:InvokeFunction"
      Resource = aws_lambda_function.ec2_scheduler.arn
    }]
  })
}

resource "aws_scheduler_schedule" "start_cluster" {
  name       = "${var.project_name}-${var.environment}-start-cluster"
  group_name = "default"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression          = var.start_cron
  schedule_expression_timezone = var.schedule_timezone

  target {
    arn      = aws_lambda_function.ec2_scheduler.arn
    role_arn = aws_iam_role.scheduler_invocation.arn
    input    = jsonencode({ action = "start" })
  }
}

resource "aws_scheduler_schedule" "stop_cluster" {
  name       = "${var.project_name}-${var.environment}-stop-cluster"
  group_name = "default"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression          = var.stop_cron
  schedule_expression_timezone = var.schedule_timezone

  target {
    arn      = aws_lambda_function.ec2_scheduler.arn
    role_arn = aws_iam_role.scheduler_invocation.arn
    input    = jsonencode({ action = "stop" })
  }
}

resource "aws_lambda_permission" "allow_scheduler_start" {
  statement_id  = "AllowSchedulerStart"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ec2_scheduler.function_name
  principal     = "scheduler.amazonaws.com"
  source_arn    = aws_scheduler_schedule.start_cluster.arn
}

resource "aws_lambda_permission" "allow_scheduler_stop" {
  statement_id  = "AllowSchedulerStop"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ec2_scheduler.function_name
  principal     = "scheduler.amazonaws.com"
  source_arn    = aws_scheduler_schedule.stop_cluster.arn
}