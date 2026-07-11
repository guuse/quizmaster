import { avatarColor, initials } from "../lib/util";

/** Initials avatar with a deterministic color derived from the player's id. */
export function Avatar({
  name,
  seed,
  size = 26,
}: {
  name: string;
  seed: string;
  size?: number;
}) {
  return (
    <span
      aria-hidden="true"
      className="grid flex-none place-items-center rounded-lg font-display text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: avatarColor(seed),
        fontSize: Math.round(size * 0.42),
      }}
    >
      {initials(name)}
    </span>
  );
}
