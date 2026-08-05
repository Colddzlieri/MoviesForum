const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { updateDb, readDb } = require('./db');

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    bannerUrl: user.bannerUrl,
    role: user.role || 'user',
    createdAt: user.createdAt,
  };
}

function cleanProfileImage(value, label) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }

  const supported = /^data:image\/(png|jpe?g|webp|gif|avif);base64,[A-Za-z0-9+/=]+$/i.test(text);
  if (!supported) {
    const error = new Error(`${label} must be a valid image file.`);
    error.status = 400;
    throw error;
  }

  if (text.length > 7_000_000) {
    const error = new Error(`${label} image is too large.`);
    error.status = 413;
    throw error;
  }

  return text;
}

function syncEmbeddedUser(db, user) {
  const authorPatch = {
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
  };

  (db.posts || []).forEach((post) => {
    if (post.author?.id === user.id) {
      post.author = { ...post.author, ...authorPatch };
    }

    (post.comments || []).forEach((comment) => {
      if (comment.author?.id === user.id) {
        comment.author = { ...comment.author, ...authorPatch };
      }

      (comment.replies || []).forEach((reply) => {
        if (reply.author?.id === user.id) {
          reply.author = { ...reply.author, ...authorPatch };
        }
      });
    });
  });

  Object.values(db.reviews || {}).forEach((reviews) => {
    (Array.isArray(reviews) ? reviews : []).forEach((review) => {
      if (review.userId === user.id) {
        review.name = user.name;
        review.avatarUrl = user.avatarUrl;
      }

      (review.replies || []).forEach((reply) => {
        if (reply.userId === user.id) {
          reply.name = user.name;
          reply.avatarUrl = user.avatarUrl;
        }
      });
    });
  });

  (db.activities || []).forEach((activity) => {
    if (activity.user?.id === user.id) {
      activity.user = { ...activity.user, ...authorPatch, role: user.role || activity.user.role || 'user' };
    }
  });
}

async function ensureAdminUser() {
  const passwordHash = await bcrypt.hash('Cold', 10);
  updateDb((db) => {
    db.users = Array.isArray(db.users) ? db.users : [];
    const existing = db.users.find((user) => user.email === 'cold');
    if (existing) {
      existing.name = 'Cold';
      existing.role = 'admin';
      existing.passwordHash = passwordHash;
      return;
    }
    db.users.push({
      id: 'cold-admin',
      name: 'Cold',
      email: 'cold',
      passwordHash,
      role: 'admin',
      createdAt: new Date().toISOString(),
    });
  });
}

function signUser(user) {
  return jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET || 'dev-secret-change-me', {
    expiresIn: '14d',
  });
}

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return res.status(401).json({ message: 'ავტორიზაცია საჭიროა.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-me');
    const user = readDb().users.find((item) => item.id === decoded.sub);
    if (!user) {
      return res.status(401).json({ message: 'მომხმარებელი ვერ მოიძებნა.' });
    }
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ message: 'სესია არასწორია ან ვადა გაუვიდა.' });
  }
}

function registerAuthRoutes(app) {
  void ensureAdminUser();

  app.post('/api/auth/register', async (req, res, next) => {
    try {
      const name = String(req.body.name || '').trim();
      const email = String(req.body.email || '').trim().toLowerCase();
      const password = String(req.body.password || '');
      const avatarUrl = req.body.avatarUrl ? String(req.body.avatarUrl) : undefined;

      if (name.length < 2 || !email.includes('@') || password.length < 6) {
        return res.status(400).json({ message: 'საჭიროა სახელი, სწორი ელფოსტა და მინიმუმ 6 სიმბოლოიანი პაროლი.' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const result = updateDb((db) => {
        db.users = Array.isArray(db.users) ? db.users : [];
        if (db.users.some((user) => user.email === email)) {
          return { duplicate: true };
        }
        const user = {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name,
          email,
          passwordHash,
          avatarUrl,
          role: 'user',
          createdAt: new Date().toISOString(),
        };
        db.users.push(user);
        return { user };
      });

      if (result.duplicate) {
        return res.status(409).json({ message: 'ამ ელფოსტით ანგარიში უკვე არსებობს.' });
      }

      return res.status(201).json({ user: publicUser(result.user), token: signUser(result.user) });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/api/auth/login', async (req, res, next) => {
    try {
      const email = String(req.body.email || '').trim().toLowerCase();
      const password = String(req.body.password || '');
      const user = readDb().users.find((item) => item.email === email);
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ message: 'ელფოსტა ან პაროლი არასწორია.' });
      }
      return res.json({ user: publicUser(user), token: signUser(user) });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({ user: publicUser(req.user) });
  });

  app.patch('/api/auth/profile', requireAuth, (req, res, next) => {
    try {
      const hasName = Object.prototype.hasOwnProperty.call(req.body, 'name');
      const hasEmail = Object.prototype.hasOwnProperty.call(req.body, 'email');
      const hasAvatar = Object.prototype.hasOwnProperty.call(req.body, 'avatarUrl');
      const hasBanner = Object.prototype.hasOwnProperty.call(req.body, 'bannerUrl');
      const name = hasName ? String(req.body.name || '').trim() : req.user.name;
      const email = hasEmail ? String(req.body.email || '').trim().toLowerCase() : req.user.email;
      const avatarUrl = hasAvatar ? cleanProfileImage(req.body.avatarUrl, 'Avatar') : undefined;
      const bannerUrl = hasBanner ? cleanProfileImage(req.body.bannerUrl, 'Banner') : undefined;

      if (name.length < 2 || (hasEmail && !email.includes('@') && req.user.role !== 'admin')) {
        return res.status(400).json({ message: 'საჭიროა სწორი სახელი და ელფოსტა.' });
      }

      const result = updateDb((db) => {
        db.users = Array.isArray(db.users) ? db.users : [];
        const user = db.users.find((item) => item.id === req.user.id);
        if (!user) {
          return { missing: true };
        }

        if (email !== user.email && db.users.some((item) => item.email === email)) {
          return { duplicate: true };
        }

        user.name = name;
        user.email = email;
        if (hasAvatar) {
          if (avatarUrl) user.avatarUrl = avatarUrl;
          else delete user.avatarUrl;
        }
        if (hasBanner) {
          if (bannerUrl) user.bannerUrl = bannerUrl;
          else delete user.bannerUrl;
        }

        syncEmbeddedUser(db, user);
        return { user };
      });

      if (result.missing) {
        return res.status(404).json({ message: 'მომხმარებელი ვერ მოიძებნა.' });
      }
      if (result.duplicate) {
        return res.status(409).json({ message: 'ამ ელფოსტით ანგარიში უკვე არსებობს.' });
      }

      return res.json({ user: publicUser(result.user) });
    } catch (error) {
      return next(error);
    }
  });
}

module.exports = { publicUser, registerAuthRoutes, requireAuth };
