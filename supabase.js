// Supabase access layer.
// The SDK (~120KB) is imported lazily: visitors who never sign in or open the
// community feed never download it.

const SUPABASE_URL = 'https://eewijrhkcysuexmazpft.supabase.co';
// Public anon key — safe to ship, access is enforced by Row Level Security.
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVld2lqcmhrY3lzdWV4bWF6cGZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MDc0NzcsImV4cCI6MjA4NjI4MzQ3N30.gFwn0fMNYrBliHn2pA44ejalzMJqk0ol2xn2aQdTSv0';
// Pinned version, two independent CDNs: auth must not hinge on a single host.
const SDK_URLS = [
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm',
    'https://esm.sh/@supabase/supabase-js@2.118.0'
];
const SESSION_KEY = 'sb-eewijrhkcysuexmazpft-auth-token';

const FEED_COLUMNS = 'id,url,prompt,genre,style,seed,user_id,created_at,views_count,profiles(username,avatar_url),likes(count)';

let clientPromise = null;
let authListener = null;

/** True when a session (or an auth redirect) is waiting, so the SDK must boot now. */
export function shouldBootEarly() {
    try {
        if (localStorage.getItem(SESSION_KEY)) return true;
    } catch { /* storage unavailable */ }
    return /access_token|refresh_token|error_description|type=(signup|recovery|magiclink|invite)/.test(location.hash + location.search);
}

export function onAuth(cb) { authListener = cb; }

async function loadSdk() {
    let lastErr;
    for (const url of SDK_URLS) {
        try { return await import(url); } catch (err) { lastErr = err; }
    }
    throw lastErr;
}

export function client() {
    if (!clientPromise) {
        clientPromise = loadSdk().then(({ createClient }) => {
            const c = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
            });
            c.auth.onAuthStateChange((event, session) => authListener?.(event, session));
            return c;
        }).catch((err) => {
            clientPromise = null; // allow a retry
            throw err;
        });
    }
    return clientPromise;
}

const unwrap = ({ data, error }) => {
    if (error) throw error;
    return data;
};

// ---------------------------------------------------------------- auth

export const auth = {
    async session() {
        const c = await client();
        return unwrap(await c.auth.getSession()).session;
    },
    async signUp(email, password, username) {
        const c = await client();
        return unwrap(await c.auth.signUp({
            email, password,
            options: { data: { username }, emailRedirectTo: location.origin + location.pathname }
        }));
    },
    async signIn(email, password) {
        const c = await client();
        return unwrap(await c.auth.signInWithPassword({ email, password }));
    },
    async signOut() {
        const c = await client();
        const { error } = await c.auth.signOut();
        if (error) throw error;
    },
    async updateMeta(data) {
        const c = await client();
        return unwrap(await c.auth.updateUser({ data })).user;
    }
};

// ---------------------------------------------------------------- data

async function decorate(c, rows, userId) {
    let liked = new Set();
    if (userId && rows.length) {
        const likes = unwrap(await c.from('likes')
            .select('wallpaper_id')
            .eq('user_id', userId)
            .in('wallpaper_id', rows.map((r) => r.id)));
        liked = new Set(likes.map((l) => l.wallpaper_id));
    }
    return rows.map((r) => ({
        ...r,
        author_name: r.profiles?.username || 'Anonymous',
        author_avatar: r.profiles?.avatar_url || null,
        likes_count: r.likes?.[0]?.count ?? 0,
        views_count: r.views_count || 0,
        is_liked: liked.has(r.id)
    }));
}

export const db = {
    /**
     * Paginated public feed.
     * @param {{userId?:string, offset?:number, limit?:number, sort?:'new'|'top',
     *          q?:string, creatorId?:string, userIds?:string[]}} o
     */
    async feed({ userId = null, offset = 0, limit = 24, sort = 'new', q = '', creatorId = null, userIds = null } = {}) {
        const c = await client();
        if (userIds && userIds.length === 0) return [];

        let query = c.from('wallpapers').select(FEED_COLUMNS).eq('is_public', true);
        if (creatorId) query = query.eq('user_id', creatorId);
        if (userIds) query = query.in('user_id', userIds);

        // PostgREST filter syntax treats , ( ) * % specially — strip them from user input.
        const term = q.replace(/[%,()*\\]/g, ' ').trim();
        if (term) query = query.or(`prompt.ilike.%${term}%,genre.ilike.%${term}%,style.ilike.%${term}%`);

        query = sort === 'top'
            ? query.order('views_count', { ascending: false }).order('created_at', { ascending: false })
            : query.order('created_at', { ascending: false });

        const rows = unwrap(await query.range(offset, offset + limit - 1));
        return decorate(c, rows, userId);
    },

    async setLike(wallpaperId, userId, liked) {
        const c = await client();
        if (liked) {
            const { error } = await c.from('likes').insert([{ wallpaper_id: wallpaperId, user_id: userId }]);
            if (error && error.code !== '23505') throw error; // already liked
        } else {
            const { error } = await c.from('likes').delete().eq('wallpaper_id', wallpaperId).eq('user_id', userId);
            if (error) throw error;
        }
    },

    async followingIds(userId) {
        const c = await client();
        const rows = unwrap(await c.from('follows').select('following_id').eq('follower_id', userId));
        return rows.map((r) => r.following_id);
    },

    async setFollow(followerId, followingId, follow) {
        if (followerId === followingId) throw new Error('You cannot follow yourself');
        const c = await client();
        if (follow) {
            const { error } = await c.from('follows').insert([{ follower_id: followerId, following_id: followingId }]);
            if (error && error.code !== '23505') throw error;
        } else {
            const { error } = await c.from('follows').delete().eq('follower_id', followerId).eq('following_id', followingId);
            if (error) throw error;
        }
    },

    async incrementViews(wallpaperId) {
        const c = await client();
        const { error } = await c.rpc('increment_wallpaper_views', { p_wallpaper_id: wallpaperId });
        if (error) console.warn('increment views failed', error);
    },

    async saveMany(rows) {
        if (!rows.length) return [];
        const c = await client();
        return unwrap(await c.from('wallpapers').insert(rows).select('id,url,is_public'));
    },

    async existingUrls(userId, urls) {
        if (!urls.length) return new Set();
        const c = await client();
        const rows = unwrap(await c.from('wallpapers').select('url').eq('user_id', userId).in('url', urls));
        return new Set(rows.map((r) => r.url));
    },

    async findByUrl(url, userId) {
        const c = await client();
        return unwrap(await c.from('wallpapers').select('id,is_public').eq('url', url).eq('user_id', userId).maybeSingle());
    },

    async setPublic(id, isPublic) {
        const c = await client();
        unwrap(await c.from('wallpapers').update({ is_public: isPublic }).eq('id', id));
    },

    async credits(userId) {
        const c = await client();
        return unwrap(await c.rpc('check_and_reset_daily_credits', { p_user_id: userId }));
    },

    async deduct(userId, amount) {
        const c = await client();
        return unwrap(await c.rpc('deduct_user_credits', { p_user_id: userId, p_amount: amount }));
    },

    async profile(userId) {
        const c = await client();
        return unwrap(await c.from('profiles').select('username,avatar_url').eq('id', userId).maybeSingle());
    },

    async updateProfile(userId, updates) {
        const c = await client();
        unwrap(await c.from('profiles').update(updates).eq('id', userId));
    },

    async uploadAvatar(userId, blob) {
        const c = await client();
        const path = `${userId}/${crypto.randomUUID()}.jpg`;
        const { error } = await c.storage.from('avatars').upload(path, blob, {
            contentType: 'image/jpeg', cacheControl: '31536000'
        });
        if (error) throw error;
        return c.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    }
};
