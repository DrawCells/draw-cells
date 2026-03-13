import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/firebaseAdmin";

const lambdaClient = new LambdaClient({
  region: "eu-central-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function invokeLambda(payload: object) {
  if (process.env.LAMBDA_LOCAL_URL) {
    // Fire-and-forget, mirroring InvocationType: "Event"
    fetch(process.env.LAMBDA_LOCAL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch((err) => console.error("[lambda-local-error]", err));
    return;
  }

  const invoke = new InvokeCommand({
    FunctionName: process.env.LAMBDA_FUNCTION_NAME!,
    InvocationType: "Event",
    Payload: new TextEncoder().encode(JSON.stringify(payload)),
  });
  await lambdaClient.send(invoke);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!Array.isArray(body.frames)) {
      return NextResponse.json(
        { error: "Invalid frames array" },
        { status: 400 }
      );
    }

    const jobId = crypto.randomUUID();
    const appUrl = process.env.APP_URL!;
    const callbackUrl = `${appUrl}/api/export-video/callback`;

    await db.ref(`exportJobs/${jobId}`).set({ status: "pending" });

    await invokeLambda({ ...body, jobId, callbackUrl });

    return NextResponse.json({ jobId });
  } catch (error: any) {
    console.error("[export-video-error]", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
