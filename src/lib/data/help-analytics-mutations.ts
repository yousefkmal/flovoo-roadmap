import "server-only";

import { localDismissGap } from "@/lib/data/help-local-store";
import { getServiceSupabase } from "@/lib/data/supabase-admin";

/**
 * Writes behind the content-gap inbox. Dismissal is per item and permanent:
 * the same question asked again is the same gap, already judged.
 */
export async function dismissContentGap(kind: "query" | "feedback", ref: string): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    localDismissGap(kind, ref);
    return;
  }
  const { error } = await supabase
    .from("help_gap_dismissals")
    .upsert({ kind, ref }, { onConflict: "kind,ref" });
  if (error) throw new Error(`Failed to dismiss: ${error.message}`);
}
