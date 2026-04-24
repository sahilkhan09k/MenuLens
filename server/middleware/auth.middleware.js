import jwt from 'jsonwebtoken';

export function protect(req, res, next) {
  // Read token from Authorization header (Bearer token)
  // Falls back to cookie for backward compatibility
  let token = null;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = { id: decoded.id };
    next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}
