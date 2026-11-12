/**
 * Integração com a agenda do aparelho: qual agenda recebe os eventos, se eles
 * se repetem toda semana e quais eventos o Rumo criou. O mapeamento fica sem
 * chave estrangeira de propósito: ao apagar um bloco, a linha continua até a
 * próxima sincronização remover o evento correspondente da agenda.
 */
export const CALENDAR_SYNC_MIGRATION_SQL = `
ALTER TABLE app_state ADD COLUMN calendar_id TEXT;
ALTER TABLE app_state ADD COLUMN calendar_recurring INTEGER NOT NULL DEFAULT 1;

CREATE TABLE calendar_events (
	block_id INTEGER NOT NULL,
	weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
	calendar_id TEXT NOT NULL,
	event_id TEXT NOT NULL,
	signature TEXT NOT NULL,
	PRIMARY KEY (block_id, weekday)
);
`;
