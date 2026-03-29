import { readLogLines, getLogFilePath } from "@/lib/lumiere";
import fs from "node:fs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	const logFile = getLogFilePath();
	const encoder = new TextEncoder();

	const stream = new ReadableStream({
		start(controller) {
			// Envoyer les 50 dernières lignes existantes
			const existing = readLogLines(50);
			for (const line of existing) {
				controller.enqueue(encoder.encode(`data: ${line}\n\n`));
			}

			if (!fs.existsSync(logFile)) {
				controller.enqueue(
					encoder.encode("data: [En attente de logs...]\n\n")
				);
				// Pas de watcher possible sans fichier — on poll
			}

			let lastSize = fs.existsSync(logFile)
				? fs.statSync(logFile).size
				: 0;

			// Polling au lieu de fs.watch (plus fiable, pas de crash sur fichier manquant)
			const interval = setInterval(() => {
				try {
					if (!fs.existsSync(logFile)) return;
					const currentSize = fs.statSync(logFile).size;
					if (currentSize <= lastSize) return;

					const fd = fs.openSync(logFile, "r");
					const buffer = Buffer.alloc(currentSize - lastSize);
					fs.readSync(fd, buffer, 0, buffer.length, lastSize);
					fs.closeSync(fd);
					lastSize = currentSize;

					const newContent = buffer.toString("utf-8").trim();
					if (newContent) {
						for (const line of newContent.split("\n")) {
							controller.enqueue(
								encoder.encode(`data: ${line}\n\n`)
							);
						}
					}
				} catch {
					// Fichier supprimé ou inaccessible
				}
			}, 2000);

			// Cleanup quand le client se déconnecte
			request.signal.addEventListener("abort", () => {
				clearInterval(interval);
				try {
					controller.close();
				} catch {}
			});
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
			"X-Accel-Buffering": "no",
		},
	});
}
