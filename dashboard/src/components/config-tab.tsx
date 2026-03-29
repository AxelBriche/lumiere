"use client";

import { useEffect, useState } from "react";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { LumiereConfig } from "@/lib/types";

export function ConfigTab() {
	const [config, setConfig] = useState<LumiereConfig | null>(null);
	const [saved, setSaved] = useState(false);

	useEffect(() => {
		fetch("/api/lumiere/config")
			.then((r) => r.json())
			.then(setConfig);
	}, []);

	const handleSave = async () => {
		if (!config) return;
		await fetch("/api/lumiere/config", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(config),
		});
		setSaved(true);
		setTimeout(() => setSaved(false), 2000);
	};

	if (!config) return null;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Configuration</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="grid gap-6">
					<div className="flex items-center justify-between">
						<Label>Activer l&apos;observer</Label>
						<Switch
							checked={config.enabled}
							onCheckedChange={(checked) =>
								setConfig({ ...config, enabled: checked })
							}
						/>
					</div>

					<Separator />

					<div className="grid gap-2">
						<Label>Observations minimum</Label>
						<Input
							type="number"
							value={config.minObservations}
							onChange={(e) =>
								setConfig({
									...config,
									minObservations: parseInt(e.target.value) || 20,
								})
							}
						/>
					</div>

					<div className="grid gap-2">
						<Label>Intervalle (minutes)</Label>
						<Input
							type="number"
							value={config.intervalMinutes}
							onChange={(e) =>
								setConfig({
									...config,
									intervalMinutes: parseInt(e.target.value) || 5,
								})
							}
						/>
					</div>

					<div className="grid gap-2">
						<Label>Modèle</Label>
						<Select
							value={config.model}
							onValueChange={(value) =>
								setConfig({ ...config, model: value })
							}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="haiku">Haiku</SelectItem>
								<SelectItem value="sonnet">Sonnet</SelectItem>
								<SelectItem value="opus">Opus</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<Button onClick={handleSave}>
						{saved ? "✓ Enregistré" : "Enregistrer"}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
