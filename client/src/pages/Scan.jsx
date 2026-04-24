import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import BottomNav from '../components/BottomNav';
import { useScan } from '../context/ScanContext';
import { useLocation } from '../context/LocationContext';
import { compressImages } from '../utils/imageCompressor';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILES = 10;
const MAX_SIZE_MB = 5;

export default function Scan() {
  const navigate = useNavigate();
  const { startScan } = useScan();
  const { coords } = useLocation();
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [restaurantName, setRestaurantName] = useState('');
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const validateAndAdd = (incoming) => {
    const combined = [...files, ...incoming];
    if (combined.length > MAX_FILES) {
      toast.error(`Max ${MAX_FILES} images allowed`);
      return;
    }
    for (const f of incoming) {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        toast.error(`${f.name}: unsupported file type`);
        return;
      }
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        toast.error(`${f.name}: exceeds ${MAX_SIZE_MB}MB limit`);
        return;
      }
    }
    const newFiles = [...files, ...incoming];
    setFiles(newFiles);
    setPreviews(newFiles.map(f => URL.createObjectURL(f)));
  };

  const handleFileChange = (e) => {
    validateAndAdd(Array.from(e.target.files));
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    validateAndAdd(Array.from(e.dataTransfer.files));
  };

  const removeFile = (idx) => {
    URL.revokeObjectURL(previews[idx]);
    const newFiles = files.filter((_, i) => i !== idx);
    const newPreviews = previews.filter((_, i) => i !== idx);
    setFiles(newFiles);
    setPreviews(newPreviews);
  };

  const handleSubmit = async () => {
    if (files.length === 0) {
      toast.error('Please add at least one image');
      return;
    }
    setLoading(true);
    try {
      // Compress images before upload (10MB phone photo → ~1MB)
      toast.loading('Compressing images...', { id: 'compress' });
      const compressed = await compressImages(files);
      toast.dismiss('compress');

      const scanId = await startScan(compressed, restaurantName.trim(), coords);
      navigate(`/processing/${scanId}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Upload failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      <Navbar />
      <main className="pt-16 pb-20 px-4">
        <div className="mt-6 mb-6">
          <h1 className="text-xl font-bold text-gray-800">Scan a Menu</h1>
          <p className="text-gray-500 text-sm mt-1">Upload up to 10 menu photos — images are auto-compressed</p>
        </div>

        {/* Drop zone */}
        <div
          onClick={() => !loading && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors mb-4
            ${dragging ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-white hover:border-green-400 hover:bg-green-50'}
            ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <p className="text-4xl mb-2">📷</p>
          <p className="text-gray-600 font-medium">Tap to upload or drag & drop</p>
          <p className="text-gray-400 text-xs mt-1">JPEG, PNG, WebP · auto-compressed · up to 10 images</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={handleFileChange}
            disabled={loading}
          />
        </div>

        {/* Previews — grid layout for up to 10 images */}
        {previews.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {previews.map((src, idx) => (
              <div key={idx} className="relative">
                <img src={src} alt={`preview ${idx + 1}`} className="w-full h-24 object-cover rounded-xl border border-gray-200" />
                <button
                  onClick={() => removeFile(idx)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs leading-none"
                  disabled={loading}
                >
                  ×
                </button>
                <span className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1 rounded">
                  {idx + 1}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Restaurant name */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Restaurant name (optional)</label>
          <input
            type="text"
            value={restaurantName}
            onChange={e => setRestaurantName(e.target.value)}
            placeholder="e.g. The Green Table"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            disabled={loading}
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading || files.length === 0}
          className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-2xl text-base transition-colors"
        >
          {loading ? 'Uploading…' : 'Analyze Menu'}
        </button>
      </main>
      <BottomNav />
    </div>
  );
}
