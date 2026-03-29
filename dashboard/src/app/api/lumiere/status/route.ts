import { NextResponse } from "next/server";
import { getObserverStatus, getWorkspaceName } from "@/lib/lumiere";

export const dynamic = "force-dynamic";

export async function GET() {
	return NextResponse.json({ ...getObserverStatus(), workspace: getWorkspaceName() });
}
