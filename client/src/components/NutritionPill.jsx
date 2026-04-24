export default function NutritionPill({ label, value }) {
  return (
    <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
      <span className="font-medium">{label}:</span>
      <span>{value}</span>
    </span>
  );
}
