const TAG_COLORS = {
  'High Protein': 'bg-blue-100 text-blue-700',
  'Low Carb': 'bg-purple-100 text-purple-700',
  'Low Calorie': 'bg-green-100 text-green-700',
  'High Calorie': 'bg-red-100 text-red-700',
  'Healthy Cook': 'bg-teal-100 text-teal-700',
  'Deep Fried': 'bg-orange-100 text-orange-700',
  'Fits Your Goal': 'bg-green-200 text-green-800',
};

export default function TagChip({ tag }) {
  const color = TAG_COLORS[tag] || 'bg-gray-100 text-gray-600';
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{tag}</span>;
}
