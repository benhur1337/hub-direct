import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Asset } from "./model";

let client: S3Client | undefined;

export class R2ConfigurationError extends Error {}

function storage() {
  const { R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } =
    process.env;
  if (
    !R2_ENDPOINT ||
    !R2_BUCKET ||
    !R2_ACCESS_KEY_ID ||
    !R2_SECRET_ACCESS_KEY
  ) {
    throw new R2ConfigurationError(
      "Configure the private R2 bucket in .env.local and restart the server.",
    );
  }
  client ??= new S3Client({
    endpoint: R2_ENDPOINT,
    region: "auto",
    forcePathStyle: true,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return { client, bucket: R2_BUCKET };
}

function objectKey(projectId: string, assetId: string) {
  return `projects/${projectId}/media/${assetId}`;
}

export async function putFile(projectId: string, asset: Asset, data: Buffer) {
  const { client, bucket } = storage();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey(projectId, asset.id),
      Body: data,
      ContentType: asset.type,
      IfNoneMatch: "*",
    }),
  );
}

export async function getFile(projectId: string, assetId: string) {
  const { client, bucket } = storage();
  try {
    const result = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey(projectId, assetId),
      }),
    );
    return result.Body!;
  } catch (error) {
    if (error instanceof S3ServiceException && error.name === "NoSuchKey")
      return;
    throw error;
  }
}

/** A one-hour link the browser loads straight from R2, or undefined when the object is not in R2. */
export async function signedFileUrl(projectId: string, asset: Asset) {
  const { client, bucket } = storage();
  const key = objectKey(projectId, asset.id);
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  } catch (error) {
    if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404) return;
    throw error;
  }
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentType: asset.type,
      ResponseCacheControl: "private, max-age=3600",
      ...(asset.type === "application/pdf" ? { ResponseContentDisposition: "attachment" } : {}),
    }),
    { expiresIn: 3600 },
  );
}

/** A ten-minute link the browser PUTs one file to; the signature pins its type and size. */
export function uploadUrl(projectId: string, asset: Asset, size: number) {
  const { client, bucket } = storage();
  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey(projectId, asset.id),
      ContentType: asset.type,
      ContentLength: size,
    }),
    { expiresIn: 600, signableHeaders: new Set(["content-type"]) },
  );
}

/** Type, size and first bytes of a browser upload, or undefined when nothing was uploaded. */
export async function uploadedFile(projectId: string, assetId: string) {
  const { client, bucket } = storage();
  try {
    const result = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: objectKey(projectId, assetId), Range: "bytes=0-255" }),
    );
    return {
      type: result.ContentType,
      size: Number(result.ContentRange?.split("/")[1]),
      head: Buffer.from(await result.Body!.transformToByteArray()),
    };
  } catch (error) {
    if (error instanceof S3ServiceException && error.name === "NoSuchKey") return;
    throw error;
  }
}

export async function deleteFile(projectId: string, assetId: string) {
  const { client, bucket } = storage();
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: objectKey(projectId, assetId),
    }),
  );
}

// Retrying a migration may find the object from a previous attempt.
export async function copyVerifiedFile(
  projectId: string,
  asset: Asset,
  data: Buffer,
) {
  try {
    await putFile(projectId, asset, data);
  } catch (error) {
    if (!(
      error instanceof S3ServiceException &&
      error.$metadata.httpStatusCode === 412
    ))
      throw error;
  }
  const body = await getFile(projectId, asset.id);
  if (!body || !data.equals(await body.transformToByteArray())) {
    throw new Error(`R2 verification failed for attachment ${asset.id}.`);
  }
}
