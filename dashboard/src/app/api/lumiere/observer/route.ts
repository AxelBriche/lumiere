import { NextResponse } from "next/server";
import { signalObserver } from "@/lib/lumiere";

export async function POST(request: Request) {
	const { action } = await request.json();

	if (action === "analyze") {
		const sent = signalObserver("SIGUSR1");
		return NextResponse.json({ success: sent, action: "analyze" });
	}

	if (action === "stop") {
		const sent = signalObserver("SIGTERM");
		return NextResponse.json({ success: sent, action: "stop" });
	}

	return NextResponse.json({ error: "Action invalide" }, { status: 400 });
}
