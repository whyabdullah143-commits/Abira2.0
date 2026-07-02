import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || (import.meta as any).env?.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = (): boolean => {
  return !!(
    supabaseUrl && 
    typeof supabaseUrl === "string" &&
    supabaseUrl.startsWith("http") &&
    supabaseUrl !== "MY_SUPABASE_URL" && 
    supabaseUrl !== "https://your-project-id.supabase.co" &&
    supabaseAnonKey &&
    supabaseAnonKey !== "MY_SUPABASE_ANON_KEY" &&
    supabaseAnonKey !== "your-anon-key" &&
    supabaseAnonKey !== "undefined"
  );
};

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Test if the Supabase connection works and the abira_messages table is accessible.
 */
export async function testSupabaseConnection(): Promise<{ success: boolean; error: any }> {
  if (!supabase) return { success: false, error: "Supabase not configured" };
  try {
    const { data, error } = await supabase
      .from("abira_messages")
      .select("id")
      .limit(1);
    
    if (error) {
      return { success: false, error };
    }
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err };
  }
}

export interface ChatMessage {
  id: string;
  sender: "user" | "abira";
  text: string;
}

/**
 * Fetch all chat messages from Supabase ordered by creation time.
 */
export async function loadMessagesFromSupabase(): Promise<ChatMessage[]> {
  if (!supabase) {
    console.warn("Supabase is not configured yet. Using localStorage fallback.");
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("abira_messages")
      .select("id, sender, text")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading messages from Supabase:", error);
      return [];
    }

    return (data || []) as ChatMessage[];
  } catch (err) {
    console.error("Exception loading messages from Supabase:", err);
    return [];
  }
}

/**
 * Save a new message to Supabase.
 */
export async function saveMessageToSupabase(message: ChatMessage): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from("abira_messages")
      .upsert({
        id: message.id,
        sender: message.sender,
        text: message.text,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error("Error saving message to Supabase:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Exception saving message to Supabase:", err);
    return false;
  }
}

/**
 * Bulk save or sync messages to Supabase.
 */
export async function syncMessagesToSupabase(messages: ChatMessage[]): Promise<boolean> {
  if (!supabase || messages.length === 0) return false;

  try {
    // Ensure rows has no duplicate IDs before upserting to avoid PostgreSQL cardinality conflict errors
    const uniqueMessagesMap = new Map<string, ChatMessage>();
    messages.forEach(msg => {
      if (msg && msg.id) {
        uniqueMessagesMap.set(msg.id, msg);
      }
    });
    const uniqueMessages = Array.from(uniqueMessagesMap.values());

    const rows = uniqueMessages.map((msg, index) => {
      const date = new Date();
      // Offset timestamps slightly to keep chronological order
      date.setSeconds(date.getSeconds() - (uniqueMessages.length - index));
      return {
        id: msg.id,
        sender: msg.sender,
        text: msg.text,
        created_at: date.toISOString()
      };
    });

    const { error } = await supabase
      .from("abira_messages")
      .upsert(rows);

    if (error) {
      console.error("Error syncing messages to Supabase:", error.message, error.details, error.hint);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Exception syncing messages to Supabase:", err);
    return false;
  }
}

/**
 * Clear all messages from Supabase.
 */
export async function clearMessagesInSupabase(): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from("abira_messages")
      .delete()
      .neq("id", ""); // Delete all records where ID is not empty

    if (error) {
      console.error("Error clearing messages from Supabase:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Exception clearing messages from Supabase:", err);
    return false;
  }
}
