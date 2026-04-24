import { createContext, useContext, useState, useEffect, useRef } from 'react';

const LocationContext = createContext(null);

/**
 * Silently requests GPS on app load.
 * Does NOT show any UI — location is captured in background.
 * Used when uploading a scan to attach restaurant location.
 */
export function LocationProvider({ children }) {
  const [coords, setCoords] = useState(null); // { lat, lng }
  const [status, setStatus] = useState('idle'); // idle | requesting | granted | denied
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;

    if (!navigator.geolocation) {
      setStatus('denied');
      return;
    }

    setStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus('granted');
      },
      () => {
        setStatus('denied');
      },
      { timeout: 8000, maximumAge: 300000 } // 5 min cache
    );
  }, []);

  return (
    <LocationContext.Provider value={{ coords, status }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used within LocationProvider');
  return ctx;
}
