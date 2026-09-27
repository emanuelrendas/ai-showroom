import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { InferenceLogRecord, InferenceLogWriter } from "./inference-wrapper";

/**
 * Concrete InferenceLogWriter backed by Supabase. Writes are append-only at
 * the database boundary (Section 4.4 doctrine, Section 6 schema): the
 * inference_logs table rejects UPDATE/DELETE via a Postgres trigger
 * regardless of caller privilege, so this adapter only ever inserts.
 */
export class SupabaseInferenceLogWriter implements InferenceLogWriter {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async write(record: InferenceLogRecord): Promise<void> {
    const { error } = await this.supabase.from("inference_logs").insert({
      workspace_id: record.workspace_id,
      project_id: record.project_id,
      mission_id: record.mission_id,
      task_type: record.task_type,
      status: record.status,
      prompt_tokens: record.prompt_tokens,
      completion_tokens: record.completion_tokens,
      total_tokens: record.total_tokens,
      model_identifier: record.model_identifier,
      latency_ms: record.latency_ms,
      cost_usd_micros: record.cost_usd_micros,
      failure_reason: record.failure_reason,
    });

    if (error) {
      throw new Error(`Unable to persist inference log: ${error.message}`);
    }
  }
}
