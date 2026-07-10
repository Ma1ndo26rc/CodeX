import { Inbox } from "lucide-react";

export default function EmptyState({ title, description = "", icon: Icon = Inbox, compact = false }) {
  return (
    <div className={`empty-state ${compact ? "is-compact" : ""}`} role="status">
      <Icon size={20} />
      <div><strong>{title}</strong>{description && <p>{description}</p>}</div>
    </div>
  );
}
