// =============================================
// SHARE TO COMMUNITY HANDLERS
// =============================================

import { uploadWallpaper, getCurrentUser } from './supabase-client.js';

// Global variable to track current wallpaper
window.currentWallpaperData = null;

// Share current wallpaper to community
window.shareToCommunity = async function () {
    const user = await getCurrentUser();

    // Check if user is logged in
    if (!user) {
        openAuthModal();
        showToast('Please sign in to share wallpapers', 'info');
        return;
    }

    // Check if we have wallpaper data
    if (!window.currentWallpaperData) {
        showToast('No wallpaper to share', 'error');
        return;
    }

    // Prompt for title and description
    const title = prompt('Give your wallpaper a title:', `${window.currentWallpaperData.genre} ${window.currentWallpaperData.style}`);
    if (!title) return; // User cancelled

    const description = prompt('Add a description (optional):', '');

    // Show loading toast
    showToast('Uploading to community...', 'info', 0);

    try {
        // Convert image URL to Blob
        const response = await fetch(window.currentWallpaperData.imageUrl);
        const blob = await response.blob();

        // Upload to Supabase
        const { data, error } = await uploadWallpaper(blob, {
            title: title,
            description: description || '',
            genre: window.currentWallpaperData.genre,
            style: window.currentWallpaperData.style,
            prompt: window.currentWallpaperData.prompt,
            seed: window.currentWallpaperData.seed,
            width: window.currentWallpaperData.width,
            height: window.currentWallpaperData.height,
            isPublic: true
        });

        if (error) throw error;

        // Success!
        showToast('✨ Shared to community!', 'success', 3000);

        // Optional: Ask if they want to view it
        setTimeout(() => {
            if (confirm('Wallpaper shared! View in community gallery?')) {
                window.location.href = '/community.html';
            }
        }, 1000);

    } catch (error) {
        console.error('Share error:', error);
        showToast(`Failed to share: ${error.message}`, 'error');
    }
};
