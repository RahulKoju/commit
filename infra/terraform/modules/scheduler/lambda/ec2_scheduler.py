import boto3
import os

def handler(event, context):
    ec2 = boto3.client("ec2")
    instance_ids = os.environ["INSTANCE_IDS"].split(",")
    action = event.get("action")

    if action == "start":
        # control-plane first, wait for it to be healthy, then worker
        ec2.start_instances(InstanceIds=[instance_ids[0]])
        waiter = ec2.get_waiter("instance_status_ok")
        waiter.wait(InstanceIds=[instance_ids[0]])
        ec2.start_instances(InstanceIds=[instance_ids[1]])
        return {"status": "started", "instances": instance_ids}

    elif action == "stop":
        # worker first, then control-plane
        ec2.stop_instances(InstanceIds=[instance_ids[1]])
        ec2.stop_instances(InstanceIds=[instance_ids[0]])
        return {"status": "stopped", "instances": instance_ids}

    raise ValueError(f"Unknown action: {action}")