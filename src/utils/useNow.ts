import { useEffect, useState } from "react";

const ONE_MINUTE_MS = 60_000;

/** Data atual que se atualiza a cada minuto, para os contadores. */
export function useNow(intervalMs: number = ONE_MINUTE_MS): Date {
	const [now, setNow] = useState(() => new Date());

	useEffect(() => {
		const timer = setInterval(() => setNow(new Date()), intervalMs);
		return () => clearInterval(timer);
	}, [intervalMs]);

	return now;
}
