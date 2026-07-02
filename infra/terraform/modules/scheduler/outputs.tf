output "lambda_function_name" {
  value = aws_lambda_function.ec2_scheduler.function_name
}

output "start_schedule_name" {
  value = aws_scheduler_schedule.start_cluster.name
}

output "stop_schedule_name" {
  value = aws_scheduler_schedule.stop_cluster.name
}