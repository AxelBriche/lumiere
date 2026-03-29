"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

/** Formate un timestamp ISO en heure locale lisible : "29 mars 20:51" */
function formatTimestamp(iso: string): string {
	const d = new Date(iso);
	if (isNaN(d.getTime())) return iso;
	return d.toLocaleString("fr-FR", {
		day: "numeric",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
	});
}

/** Remplace le timestamp ISO dans une ligne de log par un format lisible */
function formatLogLine(line: string): string {
	return line.replace(/\[([\d\-T:.Z]+)\]/, (_, iso) => `[${formatTimestamp(iso)}]`);
}

/** Extrait le message d'une ligne de log (tout après le ] du timestamp) */
function extractMessage(line: string): string {
	const match = line.match(/\] (.+)$/);
	return match ? match[1] : line;
}

/** Compresse les lignes consécutives identiques (seul le timestamp change) */
function compressLogs(lines: string[]): string[] {
	if (lines.length === 0) return [];

	const result: string[] = [];
	let i = 0;

	while (i < lines.length) {
		const msg = extractMessage(lines[i]);
		let j = i + 1;

		// Compter les lignes consécutives avec le même message
		while (j < lines.length && extractMessage(lines[j]) === msg) {
			j++;
		}

		const count = j - i;
		if (count <= 2) {
			// 1-2 lignes : afficher normalement
			for (let k = i; k < j; k++) result.push(lines[k]);
		} else {
			// 3+ lignes : première, ...(N), dernière
			result.push(lines[i]);
			result.push(`       ... (${count - 2} lignes identiques)`);
			result.push(lines[j - 1]);
		}

		i = j;
	}

	return result;
}

export function LogsTab() {
	const [logs, setLogs] = useState<string[]>([]);
	const [connected, setConnected] = useState(false);
	const [autoScroll, setAutoScroll] = useState(true);
	const scrollRef = useRef<HTMLPreElement>(null);

	useEffect(() => {
		const source = new EventSource("/api/lumiere/logs");

		source.onopen = () => setConnected(true);
		source.onerror = () => setConnected(false);
		source.onmessage = (e) => {
			setLogs((prev) => [...prev, e.data]);
		};

		return () => source.close();
	}, []);

	const compressed = useMemo(() => compressLogs(logs), [logs]);

	// Auto-scroll quand de nouveaux logs arrivent
	useEffect(() => {
		if (autoScroll && scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [compressed, autoScroll]);

	return (
		<div className="grid gap-4">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					{connected ? (
						<Badge>Connecté</Badge>
					) : (
						<Badge variant="secondary">Déconnecté</Badge>
					)}
					<span className="text-sm text-muted-foreground">
						{logs.length} lignes ({compressed.length} affichées)
					</span>
				</div>
				<div className="flex items-center gap-2">
					<Checkbox
						id="autoscroll"
						checked={autoScroll}
						onCheckedChange={(checked) =>
							setAutoScroll(checked === true)
						}
					/>
					<label htmlFor="autoscroll" className="text-sm">
						Défilement auto
					</label>
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>observer.log</CardTitle>
				</CardHeader>
				<CardContent>
					<pre
						ref={scrollRef}
						className="h-[500px] overflow-y-auto text-xs font-mono whitespace-pre-wrap"
					>
						{compressed.length > 0
							? compressed.map(formatLogLine).join("\n")
							: "En attente de logs..."}
					</pre>
				</CardContent>
			</Card>
		</div>
	);
}
