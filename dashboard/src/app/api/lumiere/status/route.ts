import { NextResponse } from "next/server";
import { getObserverStatus } from "@/lib/lumiere";

export const dynamic = "force-dynamic";

export async function GET() {
	return NextResponse.json(getObserverStatus());
}
