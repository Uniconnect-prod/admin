import { verifyAccessToken } from '../utils/token.js';
import { userRepository } from '../repositories/userRepository.js';
import { evaluateUserAccess } from '../services/accessService.js';

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Authentication required.' });
    }

    let decoded;
    try {
      decoded = verifyAccessToken(header.slice(7));
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, code: 'TOKEN_EXPIRED', message: 'Your session has expired. Refreshing…' });
      }
      return res.status(401).json({ success: false, code: 'INVALID_TOKEN', message: 'Invalid session. Please sign in again.' });
    }

    const user = await userRepository.findById(decoded.userId);
    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({ success: false, code: 'ACCOUNT_INACTIVE', message: 'Your account is not active.' });
    }

    const { evaluated, isSuperAdmin, available } = await evaluateUserAccess(user);
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      country: user.country || null,
      isSuperAdmin,
      access: evaluated,
      platforms: available
    };
    return next();
  } catch (err) {
    return next(err);
  }
}
