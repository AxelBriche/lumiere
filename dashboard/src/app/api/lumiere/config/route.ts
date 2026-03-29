import { NextResponse } from "next/server";
import { readConfig, writeConfig } from "@/lib/lumiere";

export const dynamic = "force-dynamic";

export async function GET() {
	return NextResponse.json(readConfig());
}

export async function PUT(request: Request) {
	const body = await request.json();
	const config = { ...readConfig(), ...body };
	writeConfig(config);
	return NextResponse.json(config);
}
