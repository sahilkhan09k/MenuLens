import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { to: '/home', label: 'Home', icon: '🏠' },
  { to: '/scan', label: 'Scan', icon: '📷' },
  { to: '/saved', label: 'Saved', icon: '🔖' },
  { to: '/profile', label: 'Profile', icon: '👤' },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 max-w-md mx-auto">
      <div className="flex">
        {navItems.map(item => (
          <Link key={item.to} to={item.to} className={`flex-1 flex flex-col items-center py-2 text-xs ${pathname === item.to ? 'text-green-600' : 'text-gray-500'}`}>
            <span className="text-xl">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
