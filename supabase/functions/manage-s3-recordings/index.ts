import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

interface DeleteRequest {
  action: "delete";
  filename: string;
}

interface DownloadRequest {
  action: "download";
  filename: string;
}

type Request = DeleteRequest | DownloadRequest;

// AWS S3 v4 signature generation
async function generateS3SignedUrl(
  bucket: string,
  key: string,
  accessKeyId: string,
  secretAccessKey: string,
  endpoint: string,
  expiresIn: number = 3600,
): Promise<string> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const datestamp = amzDate.slice(0, 8);

  const credentialScope = `${datestamp}/us-east-1/s3/aws4_request`;
  const canonicalRequest = `GET\n/${bucket}/${key}\n\nhost:${new URL(endpoint).host}\nx-amz-content-sha256:UNSIGNED-PAYLOAD\nx-amz-date:${amzDate}\n\nhost;x-amz-content-sha256;x-amz-date\nUNSIGNED-PAYLOAD`;

  const canonicalRequestHash = await hashSha256(canonicalRequest);
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`;

  const kDate = await hmacSha256(secretAccessKey, `AWS4${secretAccessKey}`, datestamp);
  const kRegion = await hmacSha256(kDate, "us-east-1");
  const kService = await hmacSha256(kRegion, "s3");
  const kSigning = await hmacSha256(kService, "aws4_request");
  const signature = await hmacSha256(kSigning, stringToSign);

  const signatureHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const queryParams = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresIn),
    "X-Amz-SignedHeaders": "host;x-amz-content-sha256;x-amz-date",
    "X-Amz-Signature": signatureHex,
    "X-Amz-Content-Sha256": "UNSIGNED-PAYLOAD",
  });

  return `${endpoint}/${bucket}/${key}?${queryParams.toString()}`;
}

async function hashSha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256(key: string | ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const keyBuffer = typeof key === "string" ? new TextEncoder().encode(key) : key;
  const dataBuffer = new TextEncoder().encode(data);
  return await crypto.subtle.sign("HMAC",
    await crypto.subtle.importKey("raw", keyBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]),
    dataBuffer
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json() as Request;
    const { action, filename } = body;

    const bucket = Deno.env.get("AGORA_RECORDING_BUCKET");
    const accessKey = Deno.env.get("AGORA_RECORDING_S3_ACCESS_KEY");
    const secretKey = Deno.env.get("AGORA_RECORDING_S3_SECRET_KEY");
    const endpoint = Deno.env.get("AGORA_RECORDING_S3_ENDPOINT");

    if (!bucket || !accessKey || !secretKey || !endpoint) {
      return new Response(
        JSON.stringify({ error: "S3 config not set" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "download") {
      // Generate signed URL for download
      const key = `arke/live-class/${filename}`;
      const signedUrl = await generateS3SignedUrl(bucket, key, accessKey, secretKey, endpoint, 3600);
      return new Response(
        JSON.stringify({ success: true, url: signedUrl }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } else if (action === "delete") {
      // Delete from S3
      const key = `arke/live-class/${filename}`;
      const method = "DELETE";
      const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
      const datestamp = amzDate.slice(0, 8);
      const credentialScope = `${datestamp}/us-east-1/s3/aws4_request`;

      const canonicalRequest = `${method}\n/${bucket}/${key}\n\nhost:${new URL(endpoint).host}\nx-amz-content-sha256:UNSIGNED-PAYLOAD\nx-amz-date:${amzDate}\n\nhost;x-amz-content-sha256;x-amz-date\nUNSIGNED-PAYLOAD`;
      const canonicalRequestHash = await hashSha256(canonicalRequest);
      const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`;

      const kDate = await hmacSha256(secretKey, `AWS4${secretKey}`, datestamp);
      const kRegion = await hmacSha256(kDate, "us-east-1");
      const kService = await hmacSha256(kRegion, "s3");
      const kSigning = await hmacSha256(kService, "aws4_request");
      const signature = await hmacSha256(kSigning, stringToSign);
      const signatureHex = Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${signatureHex}`;

      const deleteRes = await fetch(`${endpoint}/${bucket}/${key}`, {
        method: "DELETE",
        headers: {
          "Authorization": authHeader,
          "X-Amz-Content-Sha256": "UNSIGNED-PAYLOAD",
          "X-Amz-Date": amzDate,
        },
      });

      if (!deleteRes.ok) {
        console.error(`[Delete] HTTP ${deleteRes.status}: ${await deleteRes.text()}`);
        return new Response(
          JSON.stringify({ error: "Failed to delete from S3" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[Error]", e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
