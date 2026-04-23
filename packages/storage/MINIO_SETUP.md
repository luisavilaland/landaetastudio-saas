# MinIO Bucket Configuration

## Make bucket public (for development)

### Option 1: Using mc (MinIO Client)

```bash
# Install mc if not already installed
curl https://dl.min.io/client/mc/release/linux-amd64/mc -o mc
chmod +x mc

# Add local MinIO host
mc alias set local http://localhost:9000 minioadmin minioadmin123

# Set bucket policy to public read
mc anonymous set public local/saas-media

# Verify policy
mc anonymous list local/saas-media
```

### Option 2: Using docker exec (simpler)

```bash
# Create bucket policy JSON
echo '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":["*"]},"Action":["s3:GetObject"],"Resource":["arn:aws:s3:::saas-media/*"]}]}' > /tmp/policy.json

# Apply policy (requires mc or AWS CLI)
mcanonymous set /tmp/policy.json local/saas-media
```

### Option 3: Direct access via browser

1. Open MinIO Console: http://localhost:9001
2. Login with `minioadmin` / `minioadmin123`
3. Go to Buckets → saas-media
4. Edit Policy → Add new policy:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Principal": "*",
       "Action": ["s3:GetObject"],
       "Resource": ["arn:aws:s3:::saas-media/*"]
     }]
   }
   ```

## For Production (Cloudflare R2)

In production, use Cloudflare R2 instead of MinIO. Set these env variables:

```
MINIO_ENDPOINT=your-account.r2.cloudflarestorage.com
MINIO_PORT=443
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=your-r2-access-key
MINIO_SECRET_KEY=your-r2-secret-key
MINIO_BUCKET=saas-media
```

R2 doesn't charge for egress, making it ideal for product images.