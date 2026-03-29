"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusTab } from "@/components/status-tab";
import { IntuitionsTab } from "@/components/intuitions-tab";
import { LogsTab } from "@/components/logs-tab";
import { ConfigTab } from "@/components/config-tab";

const TABS = ["status", "intuitions", "logs", "config"] as const;
type Tab = (typeof TABS)[number];

function getInitialTab(): Tab {
	if (typeof window === "undefined") return "status";
	const hash = window.location.hash.replace("#", "");
	return TABS.includes(hash as Tab) ? (hash as Tab) : "status";
}

export default function LumiereDashboard() {
	const [tab, setTab] = useState<Tab>(getInitialTab);

	// Sync le hash sans recharger la page
	useEffect(() => {
		window.location.hash = tab;
	}, [tab]);

	return (
		<div className="mx-auto w-full max-w-5xl p-6">
			<h1 className="mb-6 text-2xl font-bold">✦ Lumiere</h1>

			<Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="w-full">
				<TabsList className="w-full">
					<TabsTrigger value="status" className="flex-1">
						Statut
					</TabsTrigger>
					<TabsTrigger value="intuitions" className="flex-1">
						Intuitions
					</TabsTrigger>
					<TabsTrigger value="logs" className="flex-1">
						Journaux
					</TabsTrigger>
					<TabsTrigger value="config" className="flex-1">
						Config
					</TabsTrigger>
				</TabsList>

				<div className="mt-4 min-h-[600px]">
					<TabsContent value="status" className="mt-0">
						<StatusTab />
					</TabsContent>

					<TabsContent value="intuitions" className="mt-0">
						<IntuitionsTab />
					</TabsContent>

					<TabsContent value="logs" className="mt-0">
						<LogsTab />
					</TabsContent>

					<TabsContent value="config" className="mt-0">
						<ConfigTab />
					</TabsContent>
				</div>
			</Tabs>

			<footer className="mt-8 pt-4 border-t text-sm text-muted-foreground">
				Créé par Axel Briche —{" "}
				<a href="https://x.com/axel_briche" target="_blank" rel="noopener noreferrer" className="underline">X</a>
				{" · "}
				<a href="https://www.malt.fr/profile/axelbriche" target="_blank" rel="noopener noreferrer" className="underline">Malt</a>
			</footer>
		</div>
	);
}
