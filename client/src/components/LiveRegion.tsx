/**
 * Visually-hidden aria-live region for announcing phase changes and countdown milestones
 * to screen readers (DESIGN.md accessibility floor). Render one per screen with the
 * message you want spoken; changing `message` triggers an announcement.
 */
export function LiveRegion({
  message,
  assertive,
}: {
  message: string;
  assertive?: boolean;
}) {
  return (
    <div
      aria-live={assertive ? "assertive" : "polite"}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}
