require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { registerAuthRoutes, requireAuth } = require('./auth');
const { readDb, updateDb } = require('./db');
const { tmdbFetch } = require('./tmdb');

const app = express();
const port = Number(process.env.PORT || 3000);

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:4200')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
}));
app.use(express.json({ limit: '18mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: 'ColdMovie API' });
});

registerAuthRoutes(app);

async function optionalAuth(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-me');
    return (await readDb()).users.find((item) => item.id === decoded.sub) || null;
  } catch {
    return null;
  }
}

function isAdminUser(user) {
  return user?.role === 'admin';
}

async function requirePostOwnerOrAdmin(req, res, next) {
  const post = ((await readDb()).posts || []).find((item) => item.id === req.params.id);
  if (!post) {
    return res.status(404).json({ message: 'Post not found.' });
  }
  if (!isAdminUser(req.user) && post.author?.id !== req.user?.id) {
    return res.status(403).json({ message: 'Only the post author can change this post.' });
  }
  return next();
}

function requirePostAdmin(req, res, next) {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ message: 'საჭიროა ადმინისტრატორის წვდომა.' });
  }
  return next();
}

function publicAuthor(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
  };
}

function toggleUserReaction(reactions, userId) {
  const list = Array.isArray(reactions) ? reactions : [];
  return list.includes(userId) ? list.filter((id) => id !== userId) : [...list, userId];
}

function publicPostReply(reply, viewerId = '') {
  const reactions = Array.isArray(reply.reactions) ? reply.reactions : [];
  return {
    id: reply.id,
    text: reply.text,
    author: reply.author,
    createdAt: reply.createdAt,
    reactionCount: reactions.length,
    reactedByMe: viewerId ? reactions.includes(viewerId) : false,
  };
}

function publicPostComment(comment, viewerId = '') {
  const reactions = Array.isArray(comment.reactions) ? comment.reactions : [];
  const replies = Array.isArray(comment.replies) ? comment.replies : [];
  return {
    id: comment.id,
    text: comment.text,
    author: comment.author,
    createdAt: comment.createdAt,
    reactionCount: reactions.length,
    reactedByMe: viewerId ? reactions.includes(viewerId) : false,
    replies: replies.map((reply) => publicPostReply(reply, viewerId)),
  };
}

function countPostComments(comments) {
  return (Array.isArray(comments) ? comments : []).reduce((total, comment) => total + 1 + (Array.isArray(comment.replies) ? comment.replies.length : 0), 0);
}

function publicPost(post, viewerId = '') {
  const likes = Array.isArray(post.likes) ? post.likes : [];
  const comments = Array.isArray(post.comments) ? post.comments : [];
  return {
    id: post.id,
    title: post.title,
    content: post.content,
    photoUrl: post.photoUrl || '',
    photoName: post.photoName || '',
    mediaItems: Array.isArray(post.mediaItems) ? post.mediaItems : [],
    author: post.author,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    viewCount: Number(post.viewCount || 0),
    likeCount: likes.length,
    commentCount: countPostComments(comments),
    likedByMe: viewerId ? likes.includes(viewerId) : false,
    comments: comments.map((comment) => publicPostComment(comment, viewerId)),
  };
}

function publicReel(reel, viewerId = '', options = {}) {
  const likes = Array.isArray(reel.likes) ? reel.likes : [];
  const comments = Array.isArray(reel.comments) ? reel.comments : [];
  const payload = {
    id: reel.id,
    caption: reel.caption,
    videoName: reel.videoName || '',
    author: reel.author,
    createdAt: reel.createdAt,
    updatedAt: reel.updatedAt,
    likeCount: likes.length,
    likedByMe: viewerId ? likes.includes(viewerId) : false,
    commentCount: comments.length,
    comments: comments.map((comment) => ({
      id: comment.id,
      text: comment.text,
      author: comment.author,
      createdAt: comment.createdAt,
    })),
  };
  if (options.includeVideo !== false) {
    payload.videoUrl = reel.videoUrl;
  }
  return payload;
}

function publicReviewReply(reply, viewerId = '') {
  const reactions = Array.isArray(reply.reactions) ? reply.reactions : [];
  return {
    id: reply.id,
    userId: reply.userId,
    name: reply.name,
    avatarUrl: reply.avatarUrl,
    text: reply.text,
    createdAt: reply.createdAt,
    reactionCount: reactions.length,
    reactedByMe: viewerId ? reactions.includes(viewerId) : false,
  };
}

function publicReview(review, viewerId = '') {
  const reactions = Array.isArray(review.reactions) ? review.reactions : [];
  const replies = Array.isArray(review.replies) ? review.replies : [];
  return {
    id: review.id,
    mediaKey: review.mediaKey,
    userId: review.userId,
    name: review.name,
    avatarUrl: review.avatarUrl,
    rating: Number(review.rating || 0),
    text: review.text,
    createdAt: review.createdAt,
    reactionCount: reactions.length,
    reactedByMe: viewerId ? reactions.includes(viewerId) : false,
    replies: replies.map((reply) => publicReviewReply(reply, viewerId)),
  };
}

function cleanMediaItem(item) {
  return {
    id: Number(item.id),
    mediaType: item.mediaType === 'tv' ? 'tv' : 'movie',
    title: String(item.title || '').trim(),
    posterUrl: String(item.posterUrl || ''),
    releaseYear: item.releaseYear ? Number(item.releaseYear) : null,
    rating: Number(item.rating || 0),
  };
}

function cleanUploadedPhoto(photoUrl, photoName = '') {
  const value = String(photoUrl || '').trim();
  if (!value) {
    return null;
  }

  const supported = /^data:image\/(png|jpe?g|webp|gif|avif);base64,[A-Za-z0-9+/=]+$/i.test(value);
  if (!supported) {
    const error = new Error('Choose a valid image file.');
    error.status = 400;
    throw error;
  }

  if (value.length > 7_000_000) {
    const error = new Error('Uploaded image is too large.');
    error.status = 413;
    throw error;
  }

  const safeName = String(photoName || 'post-photo')
    .replace(/[^\w.\- ]/g, '')
    .trim()
    .slice(0, 80);

  return {
    photoUrl: value,
    photoName: safeName || 'post-photo',
  };
}

function cleanUploadedVideo(videoUrl, videoName = '') {
  const value = String(videoUrl || '').trim();
  if (!value) {
    const error = new Error('Choose a video file.');
    error.status = 400;
    throw error;
  }

  const supported = /^data:video\/(mp4|webm|ogg|quicktime);base64,[A-Za-z0-9+/=]+$/i.test(value);
  if (!supported) {
    const error = new Error('Choose a valid video file.');
    error.status = 400;
    throw error;
  }

  if (value.length > 14_000_000) {
    const error = new Error('Uploaded video is too large.');
    error.status = 413;
    throw error;
  }

  const safeName = String(videoName || 'coldmovie-reel')
    .replace(/[^\w.\- ]/g, '')
    .trim()
    .slice(0, 100);

  return {
    videoUrl: value,
    videoName: safeName || 'coldmovie-reel',
  };
}

function logActivity(db, user, action, meta = {}) {
  if (!user?.id) return;
  const activity = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      bannerUrl: user.bannerUrl,
      role: user.role || 'user',
    },
    action,
    meta,
    createdAt: new Date().toISOString(),
  };
  db.activities = [activity, ...(db.activities || [])].slice(0, 1000);
}

function collectUsers(db) {
  const users = new Map();
  (db.users || []).forEach((user) => {
    users.set(user.id, {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      bannerUrl: user.bannerUrl,
      role: user.role || 'user',
      createdAt: user.createdAt,
    });
  });
  (db.activities || []).forEach((activity) => {
    if (activity.user?.id && !users.has(activity.user.id)) {
      users.set(activity.user.id, {
        id: activity.user.id,
        name: activity.user.name,
        email: activity.user.email,
        avatarUrl: activity.user.avatarUrl,
        bannerUrl: activity.user.bannerUrl,
        role: activity.user.role || 'user',
        createdAt: activity.createdAt,
      });
    }
  });
  (db.posts || []).forEach((post) => {
    if (post.author?.id && !users.has(post.author.id)) {
      users.set(post.author.id, {
        id: post.author.id,
        name: post.author.name,
        email: post.author.email,
        avatarUrl: post.author.avatarUrl,
        bannerUrl: post.author.bannerUrl,
        role: 'user',
        createdAt: post.createdAt,
      });
    }
  });
  return [...users.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function publicUserSummary(user, db) {
  const favorites = Object.values(db.favorites?.[user.id] || {});
  const posts = (db.posts || []).filter((post) => post.author?.id === user.id);
  const likes = posts.reduce((total, post) => total + (Array.isArray(post.likes) ? post.likes.length : 0), 0);
  const comments = posts.reduce((total, post) => total + countPostComments(post.comments), 0);
  return {
    id: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl,
    bannerUrl: user.bannerUrl,
    role: user.role || 'user',
    createdAt: user.createdAt,
    stats: {
      posts: posts.length,
      favorites: favorites.length,
      likes,
      comments,
    },
  };
}

app.get('/api/users', async (_req, res) => {
  const db = await readDb();
  const users = collectUsers(db).map((user) => publicUserSummary(user, db));
  res.json({ users });
});

app.get('/api/users/:id', async (req, res) => {
  const db = await readDb();
  const user = collectUsers(db).find((item) => item.id === req.params.id);
  if (!user) {
    return res.status(404).json({ message: 'მომხმარებელი ვერ მოიძებნა.' });
  }
  const viewer = await optionalAuth(req);
  const posts = [...(db.posts || [])]
    .filter((post) => post.author?.id === user.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((post) => publicPost(post, viewer?.id));
  const favorites = Object.values(db.favorites?.[user.id] || {});
  res.json({
    user: publicUserSummary(user, db),
    favorites,
    posts,
  });
});

app.get('/api/admin/users', requireAuth, requirePostAdmin, async (_req, res) => {
  res.json({ users: collectUsers(await readDb()) });
});

app.get('/api/admin/activities', requireAuth, requirePostAdmin, async (req, res) => {
  const query = String(req.query.q || '').trim().toLowerCase();
  const activities = ((await readDb()).activities || []).filter((activity) => {
    if (!query) return true;
    return [
      activity.user?.name,
      activity.user?.email,
      activity.user?.id,
      activity.action,
      activity.meta?.postTitle,
      activity.meta?.postId,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });
  res.json({ activities: activities.slice(0, 250) });
});

app.get('/api/posts', async (req, res) => {
  const viewer = await optionalAuth(req);
  const posts = [...((await readDb()).posts || [])]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((post) => publicPost(post, viewer?.id));
  res.json({ posts });
});

app.post('/api/posts', requireAuth, async (req, res) => {
  const title = String(req.body.title || '').trim();
  const content = String(req.body.content || '').trim();
  const mediaItems = Array.isArray(req.body.mediaItems) ? req.body.mediaItems.map(cleanMediaItem).filter((item) => item.id && item.title) : [];
  const uploadedPhoto = cleanUploadedPhoto(req.body.photoUrl, req.body.photoName);

  if (title.length < 3 || content.length < 10) {
    return res.status(400).json({ message: 'პოსტის ტექსტი სავალდებულოა.' });
  }

  const post = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    content,
    ...(uploadedPhoto || {}),
    mediaItems,
    author: publicAuthor(req.user),
    likes: [],
    comments: [],
    viewCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await updateDb((db) => {
    db.posts = [post, ...(db.posts || [])];
    logActivity(db, req.user, 'post.created', { postId: post.id, postTitle: post.title, mediaCount: mediaItems.length, hasPhoto: Boolean(uploadedPhoto) });
  });

  return res.status(201).json({ post: publicPost(post, req.user.id) });
});

app.get('/api/posts/:id', async (req, res) => {
  const viewer = await optionalAuth(req);
  let found = null;
  await updateDb((db) => {
    found = (db.posts || []).find((post) => post.id === req.params.id);
    if (found && req.query.track !== 'false') {
      found.viewCount = Number(found.viewCount || 0) + 1;
      if (viewer) {
        logActivity(db, viewer, 'post.viewed', { postId: found.id, postTitle: found.title });
      }
    }
  });

  if (!found) {
    return res.status(404).json({ message: 'პოსტი ვერ მოიძებნა.' });
  }

  return res.json({ post: publicPost(found, viewer?.id) });
});

app.patch('/api/posts/:id', requireAuth, requirePostOwnerOrAdmin, async (req, res) => {
  const title = String(req.body.title || '').trim();
  const content = String(req.body.content || '').trim();
  const mediaItems = Array.isArray(req.body.mediaItems) ? req.body.mediaItems.map(cleanMediaItem).filter((item) => item.id && item.title) : [];
  const hasPhotoField = Object.prototype.hasOwnProperty.call(req.body, 'photoUrl');
  const uploadedPhoto = hasPhotoField ? cleanUploadedPhoto(req.body.photoUrl, req.body.photoName) : null;
  let updated = null;

  if (title.length < 3 || content.length < 10) {
    return res.status(400).json({ message: 'პოსტის ტექსტი სავალდებულოა.' });
  }

  await updateDb((db) => {
    const post = (db.posts || []).find((item) => item.id === req.params.id);
    if (!post) return;
    post.title = title;
    post.content = content;
    post.mediaItems = mediaItems;
    if (hasPhotoField) {
      if (uploadedPhoto) {
        post.photoUrl = uploadedPhoto.photoUrl;
        post.photoName = uploadedPhoto.photoName;
      } else {
        delete post.photoUrl;
        delete post.photoName;
      }
    }
    post.updatedAt = new Date().toISOString();
    logActivity(db, req.user, 'post.updated', { postId: post.id, postTitle: post.title, mediaCount: mediaItems.length, hasPhoto: Boolean(post.photoUrl) });
    updated = post;
  });

  if (!updated) {
    return res.status(404).json({ message: 'პოსტი ვერ მოიძებნა.' });
  }

  return res.json({ post: publicPost(updated, req.user.id) });
});

app.delete('/api/posts/:id', requireAuth, requirePostOwnerOrAdmin, async (req, res) => {
  let removed = false;
  await updateDb((db) => {
    const post = (db.posts || []).find((item) => item.id === req.params.id);
    const before = (db.posts || []).length;
    db.posts = (db.posts || []).filter((post) => post.id !== req.params.id);
    removed = db.posts.length !== before;
    if (removed) {
      logActivity(db, req.user, 'post.deleted', { postId: req.params.id, postTitle: post?.title || 'წაშლილი პოსტი' });
    }
  });
  return removed ? res.json({ ok: true }) : res.status(404).json({ message: 'პოსტი ვერ მოიძებნა.' });
});

app.post('/api/posts/:id/like', requireAuth, async (req, res) => {
  let found = null;
  await updateDb((db) => {
    found = (db.posts || []).find((post) => post.id === req.params.id);
    if (!found) return;
    found.likes = Array.isArray(found.likes) ? found.likes : [];
    const liked = !found.likes.includes(req.user.id);
    found.likes = liked ? [...found.likes, req.user.id] : found.likes.filter((id) => id !== req.user.id);
    logActivity(db, req.user, liked ? 'post.liked' : 'post.unliked', { postId: found.id, postTitle: found.title });
  });

  if (!found) {
    return res.status(404).json({ message: 'პოსტი ვერ მოიძებნა.' });
  }

  return res.json({ post: publicPost(found, req.user.id) });
});

app.post('/api/posts/:id/comments', requireAuth, async (req, res) => {
  const text = String(req.body.text || '').trim();
  let found = null;
  let comment = null;

  if (text.length < 2) {
    return res.status(400).json({ message: 'კომენტარი ძალიან მოკლეა.' });
  }

  await updateDb((db) => {
    found = (db.posts || []).find((post) => post.id === req.params.id);
    if (!found) return;
    comment = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      text,
      author: publicAuthor(req.user),
      reactions: [],
      replies: [],
      createdAt: new Date().toISOString(),
    };
    found.comments = [comment, ...(Array.isArray(found.comments) ? found.comments : [])];
    logActivity(db, req.user, 'post.commented', { postId: found.id, postTitle: found.title, commentId: comment.id });
  });

  if (!found) {
    return res.status(404).json({ message: 'პოსტი ვერ მოიძებნა.' });
  }

  return res.status(201).json({ post: publicPost(found, req.user.id), comment });
});

app.post('/api/posts/:id/comments/:commentId/react', requireAuth, async (req, res) => {
  let found = null;
  let comment = null;

  await updateDb((db) => {
    found = (db.posts || []).find((post) => post.id === req.params.id);
    if (!found) return;
    comment = (Array.isArray(found.comments) ? found.comments : []).find((item) => item.id === req.params.commentId);
    if (!comment) return;
    comment.reactions = toggleUserReaction(comment.reactions, req.user.id);
    logActivity(db, req.user, 'post.comment.reacted', { postId: found.id, postTitle: found.title, commentId: comment.id });
  });

  if (!found) {
    return res.status(404).json({ message: 'პოსტი ვერ მოიძებნა.' });
  }
  if (!comment) {
    return res.status(404).json({ message: 'კომენტარი ვერ მოიძებნა.' });
  }

  return res.json({ post: publicPost(found, req.user.id), comment: publicPostComment(comment, req.user.id) });
});

app.post('/api/posts/:id/comments/:commentId/replies', requireAuth, async (req, res) => {
  const text = String(req.body.text || '').trim();
  let found = null;
  let comment = null;
  let reply = null;

  if (text.length < 2) {
    return res.status(400).json({ message: 'პასუხი ძალიან მოკლეა.' });
  }

  await updateDb((db) => {
    found = (db.posts || []).find((post) => post.id === req.params.id);
    if (!found) return;
    comment = (Array.isArray(found.comments) ? found.comments : []).find((item) => item.id === req.params.commentId);
    if (!comment) return;
    reply = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      text,
      author: publicAuthor(req.user),
      reactions: [],
      createdAt: new Date().toISOString(),
    };
    comment.replies = [...(Array.isArray(comment.replies) ? comment.replies : []), reply];
    logActivity(db, req.user, 'post.comment.replied', { postId: found.id, postTitle: found.title, commentId: comment.id });
  });

  if (!found) {
    return res.status(404).json({ message: 'პოსტი ვერ მოიძებნა.' });
  }
  if (!comment) {
    return res.status(404).json({ message: 'კომენტარი ვერ მოიძებნა.' });
  }

  return res.status(201).json({ post: publicPost(found, req.user.id), reply: publicPostReply(reply, req.user.id) });
});

app.post('/api/posts/:id/comments/:commentId/replies/:replyId/react', requireAuth, async (req, res) => {
  let found = null;
  let comment = null;
  let reply = null;

  await updateDb((db) => {
    found = (db.posts || []).find((post) => post.id === req.params.id);
    if (!found) return;
    comment = (Array.isArray(found.comments) ? found.comments : []).find((item) => item.id === req.params.commentId);
    if (!comment) return;
    reply = (Array.isArray(comment.replies) ? comment.replies : []).find((item) => item.id === req.params.replyId);
    if (!reply) return;
    reply.reactions = toggleUserReaction(reply.reactions, req.user.id);
    logActivity(db, req.user, 'post.comment.reply.reacted', { postId: found.id, postTitle: found.title, commentId: comment.id });
  });

  if (!found) {
    return res.status(404).json({ message: 'პოსტი ვერ მოიძებნა.' });
  }
  if (!comment || !reply) {
    return res.status(404).json({ message: 'პასუხი ვერ მოიძებნა.' });
  }

  return res.json({ post: publicPost(found, req.user.id), reply: publicPostReply(reply, req.user.id) });
});

app.get('/api/reels', async (req, res) => {
  const viewer = await optionalAuth(req);
  const reels = [...((await readDb()).reels || [])]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((reel) => publicReel(reel, viewer?.id, { includeVideo: false }));
  res.json({ reels });
});

app.get('/api/reels/:id/video', async (req, res) => {
  const reel = ((await readDb()).reels || []).find((item) => item.id === req.params.id);
  if (!reel) {
    return res.status(404).json({ message: 'Reel not found.' });
  }
  return res.json({ id: reel.id, videoUrl: reel.videoUrl });
});

app.post('/api/reels', requireAuth, async (req, res, next) => {
  try {
    const caption = String(req.body.caption || '').trim();
    const uploadedVideo = cleanUploadedVideo(req.body.videoUrl, req.body.videoName);

    if (caption.length > 180) {
      return res.status(400).json({ message: 'Caption is too long.' });
    }

    const reel = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      caption,
      ...uploadedVideo,
      author: publicAuthor(req.user),
      likes: [],
      comments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await updateDb((db) => {
      db.reels = [reel, ...(Array.isArray(db.reels) ? db.reels : [])];
      logActivity(db, req.user, 'reel.created', { reelId: reel.id, videoName: reel.videoName });
    });

    return res.status(201).json({ reel: publicReel(reel, req.user.id) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/reels/:id/like', requireAuth, async (req, res) => {
  let found = null;
  await updateDb((db) => {
    found = (db.reels || []).find((reel) => reel.id === req.params.id);
    if (!found) return;
    found.likes = toggleUserReaction(found.likes, req.user.id);
    logActivity(db, req.user, 'reel.liked', { reelId: found.id });
  });

  if (!found) {
    return res.status(404).json({ message: 'Reel not found.' });
  }

  return res.json({ reel: publicReel(found, req.user.id, { includeVideo: false }) });
});

app.post('/api/reels/:id/comments', requireAuth, async (req, res) => {
  const text = String(req.body.text || '').trim();
  if (text.length < 1 || text.length > 260) {
    return res.status(400).json({ message: 'Comment must be between 1 and 260 characters.' });
  }

  let found = null;
  let comment = null;
  await updateDb((db) => {
    found = (db.reels || []).find((reel) => reel.id === req.params.id);
    if (!found) return;
    comment = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      text,
      author: publicAuthor(req.user),
      createdAt: new Date().toISOString(),
    };
    found.comments = [...(Array.isArray(found.comments) ? found.comments : []), comment];
    found.updatedAt = new Date().toISOString();
    logActivity(db, req.user, 'reel.commented', { reelId: found.id });
  });

  if (!found) {
    return res.status(404).json({ message: 'Reel not found.' });
  }

  return res.status(201).json({ reel: publicReel(found, req.user.id, { includeVideo: false }), comment });
});

app.delete('/api/reels/:id', requireAuth, async (req, res) => {
  let removed = false;
  await updateDb((db) => {
    const reel = (db.reels || []).find((item) => item.id === req.params.id);
    if (!reel) return;
    if (!isAdminUser(req.user) && reel.author?.id !== req.user.id) return;
    db.reels = (db.reels || []).filter((item) => item.id !== req.params.id);
    removed = true;
    logActivity(db, req.user, 'reel.deleted', { reelId: req.params.id, videoName: reel.videoName });
  });

  return removed ? res.json({ ok: true }) : res.status(404).json({ message: 'Reel not found.' });
});

app.get('/api/tmdb/*path', async (req, res, next) => {
  try {
    const path = `/${Array.isArray(req.params.path) ? req.params.path.join('/') : req.params.path}`;
    const data = await tmdbFetch(path, req.query);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.get('/api/me/collections', requireAuth, async (req, res) => {
  const db = await readDb();
  res.json({
    favorites: db.favorites[req.user.id] || {},
    watchlist: db.watchlist[req.user.id] || {},
  });
});

app.put('/api/me/collections/:type', requireAuth, async (req, res) => {
  const type = req.params.type === 'watchlist' ? 'watchlist' : 'favorites';
  const value = req.body.items && typeof req.body.items === 'object' ? req.body.items : {};
  await updateDb((db) => {
    db[type][req.user.id] = value;
  });
  res.json({ ok: true });
});

app.get('/api/reviews/:mediaKey', async (req, res) => {
  const viewer = await optionalAuth(req);
  const reviews = ((await readDb()).reviews[req.params.mediaKey] || []).map((review) => publicReview(review, viewer?.id));
  res.json({ reviews });
});

app.post('/api/reviews/:mediaKey', requireAuth, async (req, res) => {
  const review = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    mediaKey: req.params.mediaKey,
    userId: req.user.id,
    name: req.user.name,
    avatarUrl: req.user.avatarUrl,
    rating: Number(req.body.rating || 0),
    text: String(req.body.text || '').trim(),
    reactions: [],
    replies: [],
    createdAt: new Date().toISOString(),
  };
  await updateDb((db) => {
    db.reviews[req.params.mediaKey] = [review, ...(db.reviews[req.params.mediaKey] || [])];
  });
  res.status(201).json({ review: publicReview(review, req.user.id) });
});

app.delete('/api/reviews/:mediaKey/:reviewId', requireAuth, async (req, res) => {
  let removed = false;
  await updateDb((db) => {
    const reviews = db.reviews[req.params.mediaKey] || [];
    const review = reviews.find((item) => item.id === req.params.reviewId);
    if (!review) return;
    if (!isAdminUser(req.user) && review.userId && review.userId !== req.user.id) return;
    if (!isAdminUser(req.user) && !review.userId && review.name !== req.user.name) return;
    db.reviews[req.params.mediaKey] = reviews.filter((item) => item.id !== req.params.reviewId);
    removed = true;
  });
  return removed ? res.json({ ok: true }) : res.status(404).json({ message: 'კომენტარი ვერ მოიძებნა.' });
});

app.post('/api/reviews/:mediaKey/:reviewId/react', requireAuth, async (req, res) => {
  let review = null;
  await updateDb((db) => {
    review = (db.reviews[req.params.mediaKey] || []).find((item) => item.id === req.params.reviewId);
    if (!review) return;
    review.reactions = toggleUserReaction(review.reactions, req.user.id);
  });

  if (!review) {
    return res.status(404).json({ message: 'კომენტარი ვერ მოიძებნა.' });
  }

  const reviews = ((await readDb()).reviews[req.params.mediaKey] || []).map((item) => publicReview(item, req.user.id));
  return res.json({ reviews, review: publicReview(review, req.user.id) });
});

app.post('/api/reviews/:mediaKey/:reviewId/replies', requireAuth, async (req, res) => {
  const text = String(req.body.text || '').trim();
  let review = null;
  let reply = null;

  if (text.length < 2) {
    return res.status(400).json({ message: 'პასუხი ძალიან მოკლეა.' });
  }

  await updateDb((db) => {
    review = (db.reviews[req.params.mediaKey] || []).find((item) => item.id === req.params.reviewId);
    if (!review) return;
    reply = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      userId: req.user.id,
      name: req.user.name,
      avatarUrl: req.user.avatarUrl,
      text,
      reactions: [],
      createdAt: new Date().toISOString(),
    };
    review.replies = [...(Array.isArray(review.replies) ? review.replies : []), reply];
  });

  if (!review) {
    return res.status(404).json({ message: 'კომენტარი ვერ მოიძებნა.' });
  }

  const reviews = ((await readDb()).reviews[req.params.mediaKey] || []).map((item) => publicReview(item, req.user.id));
  return res.status(201).json({ reviews, reply: publicReviewReply(reply, req.user.id) });
});

app.post('/api/reviews/:mediaKey/:reviewId/replies/:replyId/react', requireAuth, async (req, res) => {
  let review = null;
  let reply = null;

  await updateDb((db) => {
    review = (db.reviews[req.params.mediaKey] || []).find((item) => item.id === req.params.reviewId);
    if (!review) return;
    reply = (Array.isArray(review.replies) ? review.replies : []).find((item) => item.id === req.params.replyId);
    if (!reply) return;
    reply.reactions = toggleUserReaction(reply.reactions, req.user.id);
  });

  if (!review || !reply) {
    return res.status(404).json({ message: 'პასუხი ვერ მოიძებნა.' });
  }

  const reviews = ((await readDb()).reviews[req.params.mediaKey] || []).map((item) => publicReview(item, req.user.id));
  return res.json({ reviews, reply: publicReviewReply(reply, req.user.id) });
});

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  res.status(status).json({ message: error.message || 'Server error.', details: error.payload });
});

module.exports = app;

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}
