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

async function fetchCommunityWallpapers(currentUserId = null, offset = 0, PAGE_SIZE = 24) {
    const { data, error } = await clientInstance
        .from('wallpapers')
        .select(`
            *,
            profiles (username),
            likes (user_id)
        `)
        .eq('is_public', true)
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
    fetchWallpaperById,
    saveWallpaperToDB,
    togglePublicStatus,
    toggleLike,
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
