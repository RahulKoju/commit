# Kubernetes Manifests

## Apply Order

```bash
kubectl apply -f namespaces/
kubectl apply -f storage/
kubectl apply -f cert-manager/cert-manager.yaml
kubectl apply -f cert-manager/clusterissuer.yaml  # wait ~30s after cert-manager
kubectl apply -f config/
kubectl apply -f database/
kubectl apply -f backend/
kubectl apply -R -f frontend/
kubectl apply -f ingress/
```

## Frontend Images

Must be built with production VITE env vars:

```bash
docker build -f Dockerfile.web \
  --build-arg VITE_API_URL=https://commit.rahulkoju.com.np \
  --build-arg VITE_APP_URL=https://app.commit.rahulkoju.com.np \
  --build-arg VITE_WEB_URL=https://commit.rahulkoju.com.np \
  -t rahulkoju/commit-web:latest .
```
