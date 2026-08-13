import { Client } from 'minio'

const isR2 = !!(
  process.env.R2_ENDPOINT &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY
)

let client: Client
let bucket: string
let publicBaseUrl: string

if (isR2) {
  const endpoint = process.env.R2_ENDPOINT!
  const accessKey = process.env.R2_ACCESS_KEY_ID!
  const secretKey = process.env.R2_SECRET_ACCESS_KEY!
  bucket = process.env.R2_BUCKET_NAME || 'saas-media-prod'

  client = new Client({
    endPoint: endpoint
      .replace(/^https?:\/\//, '')
      .split('/')[0]
      .split(':')[0],
    port: endpoint.includes('https://')
      ? 443
      : endpoint.includes('http://') && !endpoint.includes(':')
        ? 80
        : undefined,
    useSSL: endpoint.startsWith('https://'),
    accessKey,
    secretKey,
    region: 'auto',
  })

  publicBaseUrl = `${endpoint}/${bucket}`
} else {
  const endpoint = process.env.MINIO_ENDPOINT || 'localhost'
  const port = parseInt(process.env.MINIO_PORT || '9000', 10)
  const accessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin'
  const secretKey = process.env.MINIO_SECRET_KEY || 'minioadmin'
  bucket = process.env.MINIO_BUCKET || 'saas-media'
  const useSSL = process.env.MINIO_USE_SSL === 'true'

  const protocol = useSSL ? 'https' : 'http'

  client = new Client({
    endPoint: endpoint,
    port,
    useSSL,
    accessKey,
    secretKey,
  })

  publicBaseUrl = `${protocol}://${endpoint}:${port}/${bucket}`
}

export { client as storageClient }

export function getPublicUrl(fileName: string): string {
  return `${publicBaseUrl}/${fileName}`
}

export async function uploadImage(
  file: Buffer,
  fileName: string,
  contentType: string,
): Promise<string> {
  const uniqueName = fileName

  await client.putObject(bucket, uniqueName, file, file.length, {
    'Content-Type': contentType,
  })

  return getPublicUrl(uniqueName)
}

export async function deleteImage(fileName: string): Promise<void> {
  if (fileName) {
    await client.removeObject(bucket, fileName)
  }
}
