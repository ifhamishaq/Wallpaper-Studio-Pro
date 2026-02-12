// Supabase Configuration
const SUPABASE_URL = 'https://eewijrhkcysuexmazpft.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVld2lqcmhrY3lzdWV4bWF6cGZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MDc0NzcsImV4cCI6MjA4NjI4MzQ3N30.gFwn0fMNYrBliHn2pA44ejalzMJqk0ol2xn2aQdTSv0';

// Initialize Supabase client
const clientInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export to window for global access
window.supabaseClient = clientInstance;

// --- DATABASE HELPERS ---

async function fetchUserWallpapers(userId) {
    const { data, error } = await clientInstance
        .from('wallpapers')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
}

async function fetchCommunityWallpapers(currentUserId = null, offset = 0, PAGE_SIZE = 24, sort = 'new') {
    let query = clientInstance
        .from('wallpapers')
        .select(`
            *,
            profiles (username, avatar_url),
            likes (user_id)
        `)
        .eq('is_public', true);

    // Sorting Logic
    if (sort === 'trending') {
        // Most Watched
        query = query.order('views_count', { ascending: false });
    } else if (sort === 'top') {
        // We can't easily sort by related table count without a materialized view or extra column.
        // For now, 'top' will also use views or we can add a likes_count column later.
        // Let's rely on views for now as a proxy for popularity.
        query = query.order('views_count', { ascending: false });
    } else {
        // Newest
        query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;

    return data.map(item => ({
        ...item,
        author_name: item.profiles ? item.profiles.username : 'Anonymous',
        author_avatar: item.profiles?.avatar_url,
        likes_count: item.likes ? item.likes.length : 0,
        views_count: item.views_count || 0,
        is_liked: currentUserId ? item.likes.some(l => l.user_id === currentUserId) : false
    }));
}

async function incrementViews(wallpaperId) {
    const { error } = await clientInstance.rpc('increment_wallpaper_views', { p_wallpaper_id: wallpaperId });
    if (error) console.error('Error incrementing views:', error);
}

async function toggleLike(wallpaperId, userId) {
    // Check if already liked
    const { data: existing, error: checkError } = await clientInstance
        .from('likes')
        .select('*')
        .eq('wallpaper_id', wallpaperId)
        .eq('user_id', userId)
        .maybeSingle();

    if (existing) {
        // Unlike
        const { error: unlikeError } = await clientInstance
            .from('likes')
            .delete()
            .eq('wallpaper_id', wallpaperId)
            .eq('user_id', userId);
        if (unlikeError) throw unlikeError;
        return { liked: false };
    } else {
        // Like
        const { error: likeError } = await clientInstance
            .from('likes')
            .insert([{ wallpaper_id: wallpaperId, user_id: userId }]);
        if (likeError) throw likeError;
        return { liked: true };
    }
}

async function fetchWallpaperById(id) {
    const { data, error } = await clientInstance
        .from('wallpapers')
        .select('*')
        .eq('id', id)
        .single();

    if (error) throw error;
    return data;
}

async function saveWallpaperToDB(wallpaperData) {
    const { data, error } = await clientInstance
        .from('wallpapers')
        .insert([wallpaperData])
        .select();

    if (error) throw error;
    return data[0];
}

async function togglePublicStatus(id, isPublic) {
    const { data, error } = await clientInstance
        .from('wallpapers')
        .update({ is_public: isPublic })
        .eq('id', id);

    if (error) throw error;
    return data;
}

async function uploadAvatar(userId, file) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    let { error: uploadError } = await clientInstance.storage
        .from('avatars')
        .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = clientInstance.storage
        .from('avatars')
        .getPublicUrl(filePath);

    return data.publicUrl;
}

async function updateProfile(userId, updates) {
    const { data, error } = await clientInstance
        .from('profiles')
        .update(updates)
        .eq('id', userId);

    if (error) throw error;
    return data;
}

async function checkAndResetCredits(userId) {
    const { data, error } = await clientInstance.rpc('check_and_reset_daily_credits', { p_user_id: userId });
    if (error) throw error;
    return data;
}

async function deductCredits(userId, amount) {
    // We use a simple update with a filter to ensure credits don't go negative
    const { data, error } = await clientInstance
        .from('profiles')
        .update({ credits: clientInstance.rpc('credits - ' + amount) }) // This won't work directly in JS client like this for atomic decr easily without RPC
        .eq('id', userId);

    // Better: use an RPC for atomic deduction
    const { data: newData, error: rpcError } = await clientInstance.rpc('deduct_user_credits', { p_user_id: userId, p_amount: amount });
    if (rpcError) throw rpcError;
    return newData;
}

async function toggleFollow(followerId, followingId) {
    if (followerId === followingId) throw new Error("You cannot follow yourself");

    const { data: existing, error: checkError } = await clientInstance
        .from('follows')
        .select('*')
        .eq('follower_id', followerId)
        .eq('following_id', followingId)
        .maybeSingle();

    if (existing) {
        const { error: unfollowError } = await clientInstance
            .from('follows')
            .delete()
            .eq('follower_id', followerId)
            .eq('following_id', followingId);
        if (unfollowError) throw unfollowError;
        return { following: false };
    } else {
        const { error: followError } = await clientInstance
            .from('follows')
            .insert([{ follower_id: followerId, following_id: followingId }]);
        if (followError) throw followError;
        return { following: true };
    }
}

async function checkFollowStatus(followerId, followingId) {
    if (!followerId) return false;
    const { data, error } = await clientInstance
        .from('follows')
        .select('id')
        .eq('follower_id', followerId)
        .eq('following_id', followingId)
        .maybeSingle();
    if (error) throw error;
    return !!data;
}

async function fetchFollowingWallpapers(currentUserId, offset = 0, PAGE_SIZE = 24) {
    const { data: following, error: followError } = await clientInstance
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUserId);

    if (followError) throw followError;
    const followingIds = following.map(f => f.following_id);

    if (followingIds.length === 0) return [];

    const { data, error } = await clientInstance
        .from('wallpapers')
        .select(`
            *,
            profiles (username),
            likes (user_id)
        `)
        .in('user_id', followingIds)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;

    return data.map(item => ({
        ...item,
        author_name: item.profiles ? item.profiles.username : 'Anonymous',
        likes_count: item.likes ? item.likes.length : 0,
        is_liked: currentUserId ? item.likes.some(l => l.user_id === currentUserId) : false
    }));
}

// --- AUTH HELPERS ---

async function signUpUser(email, password, username) {
    const { data, error } = await clientInstance.auth.signUp({
        email,
        password,
        options: {
            data: { username }
        }
    });
    if (error) throw error;
    return data;
}

async function signInUser(email, password) {
    const { data, error } = await clientInstance.auth.signInWithPassword({
        email,
        password
    });
    if (error) throw error;
    return data;
}

async function signOutUser() {
    const { error } = await clientInstance.auth.signOut();
    if (error) throw error;
}

async function getCurrentUser() {
    const { data: { user }, error } = await clientInstance.auth.getUser();
    if (error && error.status !== 401) console.warn("Auth check error:", error);
    return user;
}

async function updateUserMetadata(updates) {
    const { data, error } = await clientInstance.auth.updateUser({
        data: updates
    });
    if (error) throw error;
    return data.user;
}

window.db = {
    fetchUserWallpapers,
    fetchCommunityWallpapers,
    fetchFollowingWallpapers,
    fetchWallpaperById,
    saveWallpaperToDB,
    togglePublicStatus,
    toggleLike,
    toggleFollow,
    checkFollowStatus,
    checkAndResetCredits,
    deductCredits,
    incrementViews,
    uploadAvatar,
    updateProfile
};

window.auth = {
    signUpUser,
    signInUser,
    signOutUser,
    getCurrentUser,
    updateUserMetadata
};
