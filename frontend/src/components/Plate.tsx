/** "1AB2345" -> "1AB 2345". Other lengths are shown as typed. */
export function formatPlate(plate: string): string {
  const compact = plate.replace(/[\s-]/g, "");
  return compact.length === 7
    ? `${compact.slice(0, 3)} ${compact.slice(3)}`
    : plate;
}

/** Czech licence plate badge. Always show plates this way. */
export default function Plate({ plate }: { plate: string }) {
  return (
    <span className="plate">
      <span className="plate-eu">CZ</span>
      <span className="plate-n">{formatPlate(plate)}</span>
    </span>
  );
}
