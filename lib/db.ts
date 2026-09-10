import { Pool } from "pg";

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

export type FtdRecord = {
  contactId: string;
  amountUsd: number | null;
  createdAt: string;
};

export async function fetchFtdRecords(from: string, to: string, locationId: string): Promise<FtdRecord[]> {
  const { rows } = await getPool().query(
    `select contact_id, amount_usd, created_at
     from ftd_records
     where created_at >= $1 and created_at < $2 and location_id = $3`,
    [from, to, locationId]
  );
  return rows.map((r) => ({
    contactId: r.contact_id,
    amountUsd: r.amount_usd,
    createdAt: r.created_at.toISOString(),
  }));
}
