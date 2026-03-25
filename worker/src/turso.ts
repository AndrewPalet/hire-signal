interface TursoResponse {
  results: Array<{
    response?: {
      type: string;
      result?: {
        affected_row_count: number;
        rows: Array<Array<{ type: string; value: string }>>;
      };
    };
  }>;
}

export async function executeSQL(
  url: string,
  authToken: string,
  sql: string,
  args: Array<string | number | null> = [],
): Promise<{ affectedRows: number }> {
  const pipelineUrl = url.replace('libsql://', 'https://') + '/v3/pipeline';

  const body = {
    requests: [
      {
        type: 'execute',
        stmt: {
          sql,
          args: args.map((a) => {
            if (a === null) return { type: 'null', value: null };
            if (typeof a === 'number') return { type: 'integer', value: String(a) };
            return { type: 'text', value: String(a) };
          }),
        },
      },
      { type: 'close' },
    ],
  };

  const res = await fetch(pipelineUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Turso HTTP error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as TursoResponse;
  const result = data.results[0]?.response?.result;
  return { affectedRows: result?.affected_row_count ?? 0 };
}
