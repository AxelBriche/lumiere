"use client";

import { useEffect, useState, useCallback } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { LumiereStatus } from "@/lib/types";

function useCountdown(lastAnalysis: string | null, intervalMinutes: number) {
	const [remaining, setRemaining] = useState<string>("--:--");

	useEffect(() => {
		if (!lastAnalysis) {
			setRemaining("en attente");
			return;
		}

		const update = () => {
			const last = new Date(lastAnalysis).getTime();
			const next = last + intervalMinutes * 60_000;
			const diff = Math.max(0, next - Date.now());
			const min = Math.floor(diff / 60_000);
			const sec = Math.floor((diff % 60_000) / 1000);
			setRemaining(
				diff <= 0
					? "imminent"
					: `${min}m ${sec.toString().padStart(2, "0")}s`
			);
		};

		update();
		const timer = setInterval(update, 1000);
		return () => clearInterval(timer);
	}, [lastAnalysis, intervalMinutes]);

	return remaining;
}

export function StatusTab() {
	const [status, setStatus] = useState<LumiereStatus | null>(null);
	const [analyzing, setAnalyzing] = useState(false);

	const fetchStatus = useCallback(async () => {
		try {
			const res = await fetch("/api/lumiere/status");
			if (res.ok) setStatus(await res.json());
		} catch {}
	}, []);

	useEffect(() => {
		fetchStatus();
		const interval = setInterval(fetchStatus, 5000);
		return () => clearInterval(interval);
	}, [fetchStatus]);

	const countdown = useCountdown(
		status?.lastAnalysis ?? null,
		status?.intervalMinutes ?? 5
	);

	const forceAnalysis = async () => {
		setAnalyzing(true);
		toast.info("Analyse lancée...", {
			description: "L'observer analyse les observations en cours.",
		});

		const res = await fetch("/api/lumiere/observer", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action: "analyze" }),
		});

		const data = await res.json();

		if (data.success) {
			// Polling pour détecter quand l'analyse est terminée
			// On attend que le lastAnalysis change dans le status
			const startTime = Date.now();
			const poll = setInterval(async () => {
				const r = await fetch("/api/lumiere/status");
				const s = await r.json();
				const elapsed = Math.round((Date.now() - startTime) / 1000);

				if (
					s.lastAnalysis !== status?.lastAnalysis ||
					elapsed > 180
				) {
					clearInterval(poll);
					setAnalyzing(false);
					setStatus(s);

					if (elapsed > 180) {
						toast.warning("Analyse expirée", {
							description: "L'analyse a dépassé 3 minutes.",
						});
					} else {
						toast.success("Analyse terminée", {
							description: `${s.totalIntuitions} intuitions au total.`,
						});
					}
				}
			}, 3000);
		} else {
			setAnalyzing(false);
			toast.error("Impossible de lancer l'analyse", {
				description: "L'observer n'est pas en cours d'exécution.",
			});
		}
	};

	if (!status) return null;

	return (
		<div className="grid gap-4">
			<div className="grid grid-cols-3 gap-4">
				<Card>
					<CardHeader>
						<CardDescription>Observer</CardDescription>
						<CardTitle className="flex items-center gap-2">
							{status.running ? (
								<Badge className="bg-green-500/15 text-green-600 border-green-500/20">Actif</Badge>
							) : (
								<Badge className="bg-red-500/15 text-red-600 border-red-500/20">Arrêté</Badge>
							)}
						</CardTitle>
					</CardHeader>
					<CardContent>
						{status.pid && (
							<p className="text-sm text-muted-foreground">
								PID {status.pid}
							</p>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardDescription>Observations</CardDescription>
						<CardTitle>{status.pendingObservations}</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-muted-foreground">
							en attente
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardDescription>Intuitions</CardDescription>
						<CardTitle>{status.totalIntuitions}</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-muted-foreground">
							apprises
						</p>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardDescription>Prochaine analyse</CardDescription>
					<CardTitle className="font-mono">
						{analyzing ? "En cours..." : countdown}
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground">
						Intervalle : {status.intervalMinutes} min · Seuil :{" "}
						{status.pendingObservations}/20 observations
					</p>
				</CardContent>
			</Card>

			<div className="flex gap-2">
				<Button
					size="sm"
					onClick={forceAnalysis}
					disabled={analyzing}
				>
					{analyzing ? "Analyse en cours..." : "Forcer l'analyse"}
				</Button>
			</div>
		</div>
	);
}
