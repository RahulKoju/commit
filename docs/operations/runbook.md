# Runbook

Operational procedures and fixes for issues encountered while running this infrastructure.

---

## Cluster Won't Bootstrap

### `rke up` fails with "Etcd plane nodes are replaced"

**Cause:** `cluster.rkestate` references node IPs from a previous cluster (e.g. after `terraform destroy` + `terraform apply` created new EC2 instances with new IPs). RKE refuses to proceed to protect against accidental data loss.

**Fix:**

```bash
rm -f infra/rke/cluster.rkestate infra/rke/kube_config_cluster.yml
ssh -i ~/.ssh/commit-key.pem ubuntu@<CONTROL_PLANE_IP>
sudo docker rm -f etcd etcd-rolling-snapshots 2>/dev/null; true
sudo rm -rf /etc/kubernetes/ssl/ /var/lib/etcd/
exit
rke up
```

### `rke up` fails with TLS bad certificate on etcd health check

**Cause:** Same root issue as above — stale certificates baked with the old node's private IP as the SAN. Same fix applies.

### Port check fails: "Host X is not able to connect to port 2379/10250/8472"

**Cause:** AWS hairpin NAT — a node cannot reach its own public IP from within the VPC. RKE was using the public IP for internal checks instead of the private IP.

**Fix:** add `internal_address` (the node's private IP) to each node entry in `cluster.yml`:

```yaml
nodes:
  - address: <PUBLIC_IP>
    internal_address: <PRIVATE_IP>
    user: ubuntu
    role: [controlplane, etcd]
    ssh_key_path: ~/.ssh/commit-key.pem
```

Also confirm the security group allows the relevant ports within the VPC CIDR (etcd 2379-2380, kubelet 10250, Canal VXLAN 8472, or simply an all-traffic rule scoped to the VPC CIDR).

---

## Pods Won't Schedule

### `0/2 nodes are available: pod has unbound immediate PersistentVolumeClaims`

**Cause:** No default `StorageClass` exists. RKE doesn't install one automatically (unlike RKE2).

**Fix:**

```bash
kubectl apply -f infra/k8s/storage/local-path-provisioner.yaml
kubectl get storageclass   # confirm local-path shows as (default)
```

### `0/2 nodes are available: Insufficient cpu`

**Cause:** Scheduler reasons about CPU **requests**, not actual usage. Cumulative requests across all pods exceeded the node's allocatable CPU even though real usage (`kubectl top pods`) was low.

**Fix:** reduce `resources.requests.cpu` on the over-provisioned deployments/Helm values. Check actual usage first to confirm headroom exists:

```bash
kubectl top nodes
kubectl top pods -n <namespace>
```

### `0/2 nodes are available: untolerated taint node-role.kubernetes.io/controlplane`

**Cause:** Pod tried to schedule on the control plane, which is tainted by default to keep it free of workloads. This is expected behavior — the fix is to free up capacity on the worker, not to tolerate the taint.

---

## Docker / Ansible Issues

### `No package matching 'apt-transport-https'`

**Cause:** typo (`apt-transform-https`) in the Ansible role.

### `GPG error: NO_PUBKEY` when adding Docker repo

**Cause:** the GPG key was downloaded with `get_url` as armored text, not the binary format `apt` expects.

**Fix:** use `shell` with `curl | gpg --dearmor`:

```yaml
- name: Add Docker GPG key
  shell: |
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  args:
    creates: /etc/apt/keyrings/docker.gpg
```

If this still fails after fixing the task, the stale key file from a previous failed run may still be on disk — `creates` will skip re-running. Delete it manually first: `sudo rm /etc/apt/keyrings/docker.gpg`.

### `Unsupported Docker version found [X], supported versions are [...]`

**Cause:** RKE v1.6.4 only supports Docker up to 27.2.x; the default `apt install docker-ce` pulls the latest (29.x at time of writing).

**Fix:** pin the version using `apt-cache madison`:

```yaml
- name: Get available Docker versions
  shell: apt-cache madison docker-ce | grep "27\.2\." | head -1 | awk '{print $3}'
  register: docker_version_string
  changed_when: false

- name: Install Docker Engine and plugins
  apt:
    name:
      - "docker-ce={{ docker_version_string.stdout }}"
      - "docker-ce-cli={{ docker_version_string.stdout }}"
```

If Docker is already installed at the wrong version, uninstall first: `sudo apt-get remove -y docker-ce docker-ce-cli containerd.io`.

---

## TLS / Certificate Issues

### `kubectl get certificate` shows `READY: False` indefinitely

Check the challenge and order status:

```bash
kubectl describe certificate <name> -n <namespace>
kubectl get challenges -n <namespace>
kubectl describe challenge <challenge-name> -n <namespace>
```

Common causes: DNS record not yet propagated, DNS record proxied through Cloudflare (must be "DNS only" / grey cloud for HTTP-01 challenge to work), or nginx ingress not reachable on port 80 from the internet.

### `SSL_ERROR_NO_CYPHER_OVERLAP` / self-signed cert warning on a working domain

**Cause:** usually a propagation delay between adding the DNS record and the CDN/browser cache picking it up, or the domain was temporarily served nginx's default self-signed fallback cert before cert-manager finished issuing the real one. Re-check after a minute; verify with `kubectl get certificate -n <namespace>`.

---

## Application Issues

### Session/login redirect loop between two subdomains

**Cause:** auth cookies set without a `Domain` attribute are scoped to the exact origin hostname. If the frontend on `app.commit.rahulkoju.com.np` sets a cookie and the user is later served from `commit.rahulkoju.com.np`, the cookie isn't sent — causing an apparent "session expired" loop.

**Fix:** set the cookie `Domain` to the shared parent domain (`.rahulkoju.com.np`) in production via an environment variable (`COOKIE_DOMAIN`), left empty in development so local cookie scoping is unaffected.

### CORS error on signup/login: "Response body is not available to scripts (Reason: CORS Failed)"

**Cause:** `ALLOWED_ORIGINS` in the backend's ConfigMap doesn't include the production domain(s), or — more subtly — the ConfigMap is correct but the frontend's Docker image was built with `VITE_API_URL` pointing at `localhost`, baked in at build time.

**Fix:** confirm the ConfigMap is correct, then rebuild frontend images with the correct production `--build-arg VITE_API_URL=...` (Vite env vars are compiled into the static bundle, not read at runtime).

---

## ArgoCD Issues

### `kubectl apply -f infra/k8s/frontend/` errors with "recognized file extensions are [.json .yaml .yml]"

**Cause:** `kubectl apply -f <dir>` does not recurse into subdirectories by default.

**Fix:** add `-R`: `kubectl apply -R -f infra/k8s/frontend/`. (ArgoCD's own `directory.recurse: true` setting handles this automatically once the app is under GitOps management — this only matters for manual one-off applies.)

### ArgoCD shows "OutOfSync" but nothing seems different

> See [CI/CD & GitOps](cicd.md) for the full ArgoCD configuration reference.

Check the diff directly:

```bash
kubectl get application commit -n argocd -o yaml
```

Or via the CLI/UI's Diff tab. Usually caused by a default value injected by the cluster (e.g. an auto-generated field) that isn't in the git manifest — often safe to ignore if `selfHeal` isn't fighting it, but worth confirming it isn't masking a real drift.

---

## General Diagnostic Commands

```bash
# Cluster health
kubectl get nodes
kubectl get pods -A

# Resource pressure
kubectl top nodes
kubectl top pods -n <namespace>

# Pod troubleshooting
kubectl describe pod <pod> -n <namespace>
kubectl logs <pod> -n <namespace> -c <container>
kubectl logs <pod> -n <namespace> --previous   # logs from before last crash

# Networking
kubectl get ingress -n <namespace>
kubectl describe ingress <name> -n <namespace>
kubectl get certificate -n <namespace>
kubectl get svc -n <namespace>

# ArgoCD
kubectl get applications -n argocd
kubectl describe application <name> -n argocd
```
