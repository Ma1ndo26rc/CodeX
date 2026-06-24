export default function SectionHeader({ eyebrow, title, children }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="terminal-label">{eyebrow}</p>}
        <h2 className="terminal-title mt-1">{title}</h2>
      </div>
      {children}
    </div>
  );
}
