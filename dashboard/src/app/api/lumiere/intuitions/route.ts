import { NextResponse } from "next/server";
import {
	listIntuitions,
	writeIntuition,
	deleteIntuition,
} from "@/lib/lumiere";

export const dynamic = "force-dynamic";

export async function GET() {
	return NextResponse.json(listIntuitions());
}

export async function PUT(request: Request) {
	const { filename, content } = await request.json();
	if (!filename || !content) {
		return NextResponse.json(
			{ error: "filename et content requis" },
			{ status: 400 }
		);
	}
	writeIntuition(filename, content);
	return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
	const { filename } = await request.json();
	if (!filename) {
		return NextResponse.json(
			{ error: "filename requis" },
			{ status: 400 }
		);
	}
	const deleted = deleteIntuition(filename);
	return NextResponse.json({ success: deleted });
}
