import { useState, useEffect, useRef } from "react";
import {
  fetchActivityComments,
  fetchTeamMembersForMentions,
  createComment,
  updateComment,
  deleteComment,
  type CommentWithAuthor,
} from "@/features/comments/services/comments.service";
import { createNotifications } from "@/features/notifications/services/notifications.service";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, Send, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

interface Comment {
  id: string;
  activity_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
}

interface MentionSuggestion {
  user_id: string;
  display_name: string;
}

export function ActivityComments({ activityId, teamId }: { activityId: string; teamId: string }) {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [content, setContent] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [allMembers, setAllMembers] = useState<MentionSuggestion[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchComments = async () => {
    const list = await fetchActivityComments(activityId);
    setComments(list);
  };

  const fetchTeamMembers = async () => {
    const members = await fetchTeamMembersForMentions(teamId);
    setAllMembers(members);
  };

  useEffect(() => {
    fetchComments();
    fetchTeamMembers();
  }, [activityId]);

  const handleContentChange = (value: string) => {
    setContent(value);
    const cursorPos = textareaRef.current?.selectionStart || value.length;
    const textBeforeCursor = value.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    if (mentionMatch) {
      const query = mentionMatch[1].toLowerCase();
      setMentionQuery(query);
      setSuggestions(
        allMembers
          .filter(
            (m) =>
              m.display_name.toLowerCase().includes(query) &&
              m.user_id !== (profile?.user_id ?? user?.id)
          )
          .slice(0, 5)
      );
    } else {
      setMentionQuery(null);
      setSuggestions([]);
    }
  };

  const insertMention = (member: MentionSuggestion) => {
    const cursorPos = textareaRef.current?.selectionStart || content.length;
    const textBeforeCursor = content.substring(0, cursorPos);
    const textAfterCursor = content.substring(cursorPos);
    // FIX: usa \w* para remover apenas a parte já digitada após @
    const beforeMention = textBeforeCursor.replace(/@\w*$/, "");
    // Codifica o display_name substituindo espaços por underscore no texto do comentário
    // para que o regex de extração consiga recuperar sem ambiguidade
    const encodedName = member.display_name.replace(/\s+/g, "_");
    const newContent = `${beforeMention}@${encodedName} ${textAfterCursor}`;
    setContent(newContent);
    setMentionQuery(null);
    setSuggestions([]);
    textareaRef.current?.focus();
  };

  /**
   * Extrai user_ids mencionados no texto.
   * Estratégia: para cada token @xxx encontrado, tenta match contra display_name
   * tanto literal quanto com espaços restaurados (underscore → espaço).
   */
  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@(\S+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      const token = match[1];
      // Tenta match direto e com underscore → espaço
      const tokenNormalized = token.replace(/_/g, " ");
      const member = allMembers.find(
        (m) =>
          m.display_name === token ||
          m.display_name === tokenNormalized ||
          m.display_name.toLowerCase() === token.toLowerCase() ||
          m.display_name.toLowerCase() === tokenNormalized.toLowerCase()
      );
      if (member) mentions.push(member.user_id);
    }
    return [...new Set(mentions)];
  };

  const createMentionNotifications = async (text: string) => {
    const mentionedUserIds = extractMentions(text);
    if (mentionedUserIds.length === 0) return;

    // FIX: usa display_name do perfil; fallback para parte do e-mail
    const senderName =
      profile?.display_name ||
      profile?.full_name ||
      user?.email?.split("@")[0] ||
      "Alguém";

    // FIX: usa profile.user_id que é o ID correto na tabela notifications
    const senderId = profile?.user_id ?? user?.id ?? "";

    const notifications = mentionedUserIds
      .filter((uid) => uid !== senderId) // nunca notifica o próprio remetente
      .map((uid) => ({
        user_id: uid,
        team_id: teamId,
        type: "mention",
        title: `${senderName} mencionou você em um comentário`,
        message: text.substring(0, 120),
        link_type: "activity",
        link_id: activityId,
      }));

    if (notifications.length === 0) return;
    await createNotifications(notifications);
  };

  const handleSubmit = async () => {
    if (!content.trim() || !user) return;
    setLoading(true);
    try {
      await createComment({
        activity_id: activityId,
        team_id: teamId,
        user_id: user.id,
        content: content.trim(),
      });
      await createMentionNotifications(content.trim());
      setContent("");
      await fetchComments();
    } catch {
      toast.error("Erro ao adicionar comentário");
    }
    setLoading(false);
  };

  const handleUpdate = async (id: string) => {
    if (!editContent.trim()) return;
    await updateComment(id, editContent.trim());
    setEditId(null);
    setEditContent("");
    await fetchComments();
  };

  const handleDelete = async (id: string) => {
    await deleteComment(id);
    await fetchComments();
    toast.info("Comentário removido");
  };

  /**
   * Renderiza o conteúdo do comentário destacando menções.
   * Suporta tanto @Nome_Sobrenome (com underscore) quanto @Nome direto.
   */
  const renderContent = (text: string) => {
    const parts = text.split(/(@\S+)/g);
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        // Converte underscore de volta para espaço na exibição
        const displayPart = part.replace(/_/g, " ");
        return (
          <span key={i} className="text-primary font-semibold bg-primary/10 rounded px-0.5">
            {displayPart}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="space-y-3 mt-3 border-t pt-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <MessageCircle className="h-3.5 w-3.5" />
        Comentários ({comments.length})
      </div>

      {comments.map((c) => (
        <div key={c.id} className="bg-muted/50 rounded-lg p-2.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">{c.user_name}</span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">
                {new Date(c.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </span>
              {user?.id === c.user_id && (
                <>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setEditId(c.id); setEditContent(c.content); }}>
                    <Pencil className="h-2.5 w-2.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => handleDelete(c.id)}>
                    <Trash2 className="h-2.5 w-2.5" />
                  </Button>
                </>
              )}
            </div>
          </div>
          {editId === c.id ? (
            <div className="flex gap-2">
              <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="text-xs min-h-[60px]" />
              <div className="flex flex-col gap-1">
                <Button size="sm" className="text-xs h-7" onClick={() => handleUpdate(c.id)}>Salvar</Button>
                <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setEditId(null)}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-foreground whitespace-pre-wrap">{renderContent(c.content)}</p>
          )}
        </div>
      ))}

      <div className="relative">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Comente ou use @ para mencionar..."
            className="text-xs min-h-[50px]"
            onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) handleSubmit(); }}
          />
          <Button size="icon" className="h-[50px] w-10 shrink-0" onClick={handleSubmit} disabled={!content.trim() || loading}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {suggestions.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1 w-64 bg-popover border rounded-lg shadow-lg z-50 overflow-hidden">
            {suggestions.map((s) => (
              <button
                key={s.user_id}
                className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors"
                onClick={() => insertMention(s)}
              >
                <span className="font-medium">@{s.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
