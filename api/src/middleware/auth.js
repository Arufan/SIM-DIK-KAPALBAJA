import jwt from "jsonwebtoken";

export function signAccessToken(user) {
  return jwt.sign({ sub: user.id, username: user.username, role: user.role }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_TTL || "15m",
  });
}

export function signRefreshToken(user) {
  return jwt.sign({ sub: user.id, typ: "refresh" }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_TTL || "60d",
  });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "missing bearer token" });
  try {
    req.user = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "invalid or expired token" });
  }
}
