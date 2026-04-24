import { createContext, useContext, useState, useRef } from 'react';
import api from '../utils/api';

const ScanContext = createContext(null);

export function ScanProvider({ children }) {
  const [scanId, setScanId] = useState(null);
  const [images, setImages] = useState([]);
  const [status, setStatus] = useState('idle'); // idle|uploading|processing|done|error
  const [results, setResults] = useState(null);
  const pollRef = useRef(null);

  const startScan = async (files, restaurantName = '', coords = null) => {
    setImages(files);
    setStatus('uploading');
    const formData = new FormData();
    files.forEach(f => formData.append('images', f));
    if (restaurantName) formData.append('restaurantName', restaurantName);
    // Attach GPS coordinates if available — server uses these to find restaurant name
    if (coords?.lat && coords?.lng) {
      formData.append('lat', coords.lat);
      formData.append('lng', coords.lng);
    }
    const res = await api.post('/api/scan', formData);
    setScanId(res.data.scanId);
    setStatus('processing');
    return res.data.scanId;
  };

  const pollStatus = (id) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/api/scan/${id}`);
        const scan = res.data;
        if (scan.status === 'complete') {
          clearInterval(pollRef.current);
          setResults(scan);
          setStatus('done');
        } else if (scan.status === 'failed') {
          clearInterval(pollRef.current);
          setStatus('error');
        }
      } catch {
        clearInterval(pollRef.current);
        setStatus('error');
      }
    }, 3000);
  };

  const clearScan = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setScanId(null);
    setImages([]);
    setStatus('idle');
    setResults(null);
  };

  return (
    <ScanContext.Provider value={{ scanId, images, status, results, startScan, pollStatus, clearScan }}>
      {children}
    </ScanContext.Provider>
  );
}

export function useScan() {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error('useScan must be used within ScanProvider');
  return ctx;
}
