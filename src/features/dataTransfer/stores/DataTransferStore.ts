import { create } from "zustand";
import type { Database } from "@/database/client";
import {
	applyRumoData,
	buildPreview,
	incomingCounts,
} from "@/database/repositories/transferRepository";
import {
	type OpenRumoFile,
	readRumoFile,
} from "@/features/dataTransfer/rumoFile";
import type {
	RumoFileData,
	TransferPreview,
} from "@/features/dataTransfer/types";
import { useAddictionStore } from "@/features/addictions/stores/AddictionStore";
import { useProfileStore } from "@/features/profile/stores/ProfileStore";

interface DataTransferState {
	preview: TransferPreview | null;
	/** Conteúdo do arquivo escolhido; fica só em memória até confirmar. */
	pending: RumoFileData | null;
	prepare: (
		db: Database,
		open: OpenRumoFile,
		file: { name: string; bytes: Uint8Array },
	) => Promise<TransferPreview>;
	confirm: (db: Database) => Promise<boolean>;
	reset: () => void;
}

export const useDataTransferStore = create<DataTransferState>((set, get) => ({
	preview: null,
	pending: null,
	prepare: async (db, open, file) => {
		const data = await readRumoFile(open, file.bytes);
		const counts = incomingCounts(data);
		const empty = Object.values(counts).every((total) => total === 0);
		const preview = await buildPreview(db, file.name, data);
		set({ preview, pending: empty ? null : data });
		return preview;
	},
	confirm: async (db) => {
		const { pending } = get();
		if (!pending) return false;
		await applyRumoData(db, pending);
		set({ preview: null, pending: null });
		// As telas leem destes stores: força recarregar do banco restaurado.
		useAddictionStore.setState({
			addictions: [],
			details: {},
			isLoaded: false,
		});
		await useProfileStore.getState().load(db);
		return true;
	},
	reset: () => set({ preview: null, pending: null }),
}));
