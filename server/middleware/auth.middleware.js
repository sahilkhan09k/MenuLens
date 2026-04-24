import jwt from 'jsonwebtoken';

export function protect(req, res, next) {
  const token = req.cookies?.accessToken;

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
