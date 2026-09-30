/** Up to two initials for an avatar: "Nimal Perera" → "NP", "nimal@medicore.lk" → "NM". */
export function initialsOf(name: string): string {
  return (
    name
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}
