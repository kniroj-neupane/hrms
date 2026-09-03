import { env } from "@/env";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type PutObjectCommandInput,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { TRPCError } from "@trpc/server";

export type FileObject = {
  Key?: string;
  LastModified?: Date;
  ETag?: string;
  Size?: number;
  StorageClass?: string;
};

export const PUT_ASSETS_EXPIRES_IN = 4 * 60;

const requireR2Config = () => {
  const endpoint = env.NEXT_PUBLIC_R2_ENDPOINT_URL;
  const bucket = env.NEXT_PUBLIC_R2_BUCKET_NAME;
  const publicUrl = env.NEXT_PUBLIC_R2_PUBLIC_URL;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !bucket || !publicUrl || !accessKeyId || !secretAccessKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "R2 storage is not configured. Set R2 and NEXT_PUBLIC_R2_* environment variables.",
    });
  }

  return { endpoint, bucket, publicUrl, accessKeyId, secretAccessKey };
};

/**
 * Generate a public URL for accessing uploaded photos
 * @param filename - The name of the uploaded file
 * @returns The complete public URL for accessing the file
 */
const getPublicUrl = (filename: string) => {
  const { publicUrl } = requireR2Config();
  return `${publicUrl}/${filename}`;
};

// Lazy: constructing S3Client with undefined credentials fails at import time.
let client: S3Client | undefined;
const getClient = () => {
  if (client) return client;
  const { endpoint, accessKeyId, secretAccessKey } = requireR2Config();
  client = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true, // Required for R2 compatibility
    apiVersion: "2006-03-01",
  });
  return client;
};

export async function uploadFile(file: Buffer, key: string): Promise<string> {
  const { endpoint, bucket } = requireR2Config();
  const params: PutObjectCommandInput = {
    Bucket: bucket,
    Key: key,
    Body: file,
  };

  try {
    const command = new PutObjectCommand(params);
    await getClient().send(command);

    return `${endpoint}/${key}`;
  } catch (error) {
    console.error("Error uploading file to R2:", error);
    throw error;
  }
}

export async function getSignedUrlForUpload({
  key,
  contentType,
}: {
  key: string;
  contentType: string;
}) {
  const { bucket } = requireR2Config();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  try {
    const signedUrl = await getSignedUrl(getClient(), command, {
      expiresIn: PUT_ASSETS_EXPIRES_IN,
    });

    const publicUrl = getPublicUrl(key);

    return {
      uploadUrl: signedUrl,
      path: key,
      publicUrl,
    };
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    console.error("Error generating signed URL:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to generate signed URL for upload",
    });
  }
}

export async function getSignedUrlForDownload(key: string): Promise<string> {
  const { bucket } = requireR2Config();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  try {
    const signedUrl = await getSignedUrl(getClient(), command, {
      expiresIn: 3600,
    });
    return signedUrl;
  } catch (error) {
    console.error("Error generating signed URL:", error);
    throw error;
  }
}

export async function listFiles(prefix = ""): Promise<FileObject[]> {
  const { bucket } = requireR2Config();
  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
  });

  try {
    const response = await getClient().send(command);
    return response.Contents ?? [];
  } catch (error) {
    console.error("Error listing files:", error);
    throw error;
  }
}

export async function deleteFile(key: string) {
  const { bucket } = requireR2Config();
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  try {
    const response = await getClient().send(command);
    return response;
  } catch (error) {
    console.error("Error deleting file:", error);
    throw error;
  }
}
