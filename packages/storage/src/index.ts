import { Client } from "minio";

const endpoint = process.env.MINIO_ENDPOINT || "localhost";
const port = parseInt(process.env.MINIO_PORT || "9000", 10);
const accessKey = process.env.MINIO_ACCESS_KEY || "minioadmin";
const secretKey = process.env.MINIO_SECRET_KEY || "minioadmin";
const bucket = process.env.MINIO_BUCKET || "saas-media";
const useSSL = process.env.MINIO_USE_SSL === "true";

const protocol = useSSL ? "https" : "http";

export const minioClient = new Client({
  endPoint: endpoint,
  port,
  useSSL,
  accessKey,
  secretKey,
});

export function getPublicUrl(fileName: string): string {
  const baseUrl = `${protocol}://${endpoint}:${port}/${bucket}`;
  return `${baseUrl}/${fileName}`;
}

export async function uploadImage(
  file: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  const uniqueName = `products/${Date.now()}-${fileName}`;

  await minioClient.putObject(bucket, uniqueName, file, file.size, {
    "Content-Type": contentType,
  });

  return getPublicUrl(uniqueName);
}

export async function deleteImage(fileName: string): Promise<void> {
  if (fileName) {
    await minioClient.removeObject(bucket, fileName);
  }
}