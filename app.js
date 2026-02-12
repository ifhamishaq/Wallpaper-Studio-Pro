// --- START OF FILE app.js ---

// Wallpaper Studio Pro - Main Application
import { GENRES, STYLES, API_CONFIG, APP_CONFIG } from './config.js';

// ============================================================================
// STATE MANAGEMENT & GLOBALS
// ============================================================================
const state = {
    activeGenreIndex: 0,
    activeStyleIndex: 0,
    selectedColorBias: null,
    isDesktopMode: false,
    customColor: null,
    favorites: JSON.parse(localStorage.getItem('wallpaper_favorites') || '[]'),
    advancedMode: false,
    batchMode: false,
    seed: null,
    numSteps: 4,
    historyFilter: 'all',
    activeView: 'create',
    currentUser: null,
    isPromptManuallyEdited: false,
    communityPage: 0,
    isLoadingCommunity: false,
    hasMoreCommunity: true,
    activeCommunityFilter: 'all',
    communitySource: 'all'
};

// Global WebGL Variables
let targetColor = new THREE.Color(0x444444);
let particleMaterial = null;

// Global Timer for Typewriter Effect
let typewriterTimeout = null;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function isMobileDevice() {
    return window.innerWidth < 768;
}

function showToast(message, type = 'info', duration = 3000) {
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const iconMap = {
        success: 'check-circle',
        error: 'alert-circle',
        info: 'info',
        warning: 'alert-triangle'
    };

    toast.innerHTML = `
        <i data-lucide="${iconMap[type] || 'info'}" class="w-5 h-5"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('Copied to clipboard!', 'success');
    } catch (err) {
        showToast('Failed to copy', 'error');
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================
window.onload = () => {
    if (window.lucide) lucide.createIcons();

    loadPreferences();

    initCarousel();
    initSwipeGestures();
    initParallax();
    initWebGL();

    // New UI/UX Initializations
    initMagneticButtons();
    initShinyBorders();

    initKeyboardNavigation();
    renderHistory();
    renderFavorites();
    updateTime();

    const generateBtn = document.getElementById('generate-button');
    if (generateBtn) generateBtn.addEventListener('click', handleGenerate);

    // Initial Auth Check
    if (window.auth) {
        auth.getCurrentUser().then(user => {
            if (user) handleUserLogin(user);
        });
    }

    // Supabase Auth Listener
    if (window.supabaseClient) {
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN') handleUserLogin(session.user);
            if (event === 'SIGNED_OUT') handleUserLogout();
        });
    }
    const promptInput = document.getElementById('custom-prompt');
    if (promptInput) {
        promptInput.addEventListener('input', () => {
            state.isPromptManuallyEdited = true;
        });
    }

    updateCarouselUI();
    renderHistory();
    renderFavorites();
};

function loadPreferences() {
    const saved = localStorage.getItem('wallpaper_preferences');
    if (saved) {
        try {
            const prefs = JSON.parse(saved);
            state.activeGenreIndex = prefs.genreIndex || 0;
            state.activeStyleIndex = prefs.styleIndex || 0;
        } catch (e) {
            console.error("Error loading preferences", e);
        }
    }
}

function savePreferences() {
    localStorage.setItem('wallpaper_preferences', JSON.stringify({
        genreIndex: state.activeGenreIndex,
        styleIndex: state.activeStyleIndex
    }));
}

// ============================================================================
// CAROUSEL & UI LOGIC
// ============================================================================
function initCarousel() {
    const genreTrack = document.getElementById('genre-track');
    const styleTrack = document.getElementById('style-track');

    if (!GENRES || !STYLES) return;

    const buildSlides = (items, track) => {
        track.innerHTML = '';
        items.forEach((item) => {
            const el = document.createElement('div');
            el.className = 'carousel-item';
            el.style.backgroundImage = `url('${item.image}')`;
            el.innerHTML = `<div class="w-full h-full carousel-overlay"></div>`;
            track.appendChild(el);
        });
    };

    buildSlides(GENRES, genreTrack);
    buildSlides(STYLES, styleTrack);
}

function updateCarouselUI() {
    if (!GENRES || !STYLES) return;

    const genreTrack = document.getElementById('genre-track');
    const styleTrack = document.getElementById('style-track');

    if (genreTrack) genreTrack.style.transform = `translateX(-${state.activeGenreIndex * 100}%)`;
    if (styleTrack) styleTrack.style.transform = `translateX(-${state.activeStyleIndex * 100}%)`;

    // Active Slide Classes (Category A: Transitions)
    if (genreTrack) {
        Array.from(genreTrack.children).forEach((child, index) => {
            if (index === state.activeGenreIndex) child.classList.add('is-active');
            else child.classList.remove('is-active');
        });
    }

    if (styleTrack) {
        Array.from(styleTrack.children).forEach((child, index) => {
            if (index === state.activeStyleIndex) child.classList.add('is-active');
            else child.classList.remove('is-active');
        });
    }

    // Update Labels
    const genreLabel = document.getElementById('genre-label');
    const styleLabel = document.getElementById('style-label');
    if (genreLabel) genreLabel.innerText = GENRES[state.activeGenreIndex].name;
    if (styleLabel) styleLabel.innerText = STYLES[state.activeStyleIndex].name;

    // Category A & Feature 3C: Aurora Background & WebGL Color Sync
    const newColorHex = GENRES[state.activeGenreIndex].color || 0x444444;
    targetColor.setHex(newColorHex);
    updateAuroraColors(newColorHex);

    // Category B: Typewriter Prompt
    updateCustomPromptPlaceholder();
    savePreferences();
}

// Category A: Update CSS Variables for Aurora Background
function updateAuroraColors(hexColor) {
    const color = new THREE.Color(hexColor);
    const r = color.r * 255;
    const g = color.g * 255;
    const b = color.b * 255;

    // Set CSS variable for gradients if supported in CSS
    document.documentElement.style.setProperty('--aurora-color', `rgba(${r}, ${g}, ${b}, 0.4)`);
    document.documentElement.style.setProperty('--aurora-color-secondary', `rgba(${r}, ${g}, ${b}, 0.1)`);
}

// Category B: Typewriter Effect for Prompt
function updateCustomPromptPlaceholder() {
    if (!GENRES || !STYLES) return;

    const genre = GENRES[state.activeGenreIndex].prompt;
    const style = STYLES[state.activeStyleIndex].prompt;
    const color = state.selectedColorBias ? `, ${state.selectedColorBias} color palette` : '';
    const customColorText = state.customColor ? `, ${state.customColor} tones` : '';
    const text = `${genre}, ${style}${color}${customColorText}.wallpaper, highly detailed.`;

    const area = document.getElementById('custom-prompt');
    if (!area) return;

    area.placeholder = text;

    if (!state.isPromptManuallyEdited) {
        // Clear previous timeout to avoid overlapping typing
        if (typewriterTimeout) clearTimeout(typewriterTimeout);

        let i = 0;
        area.value = "";
        const speed = 1; // ms per char

        function type() {
            if (i < text.length) {
                area.value += text.charAt(i);
                i++;
                typewriterTimeout = setTimeout(type, speed);
            }
        }
        type();
    }
}

// ============================================================================
// MICRO-INTERACTIONS (CATEGORY B)
// ============================================================================

// B5: Magnetic Buttons
function initMagneticButtons() {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isMobileDevice() || prefersReducedMotion) return;

    // Select all buttons and interactive elements
    const btns = document.querySelectorAll('.btn-haptic, button, .catalog-btn, [role="button"]');

    btns.forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            // Calculate distance from center
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;

            // Move button slightly towards mouse (Magnetic effect)
            btn.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px)`;
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translate(0px, 0px)';
        });

        // B8: Interactive Squeeze Click
        btn.addEventListener('mousedown', () => {
            btn.style.transform = 'scale(0.95, 0.95)';
        });

        btn.addEventListener('mouseup', () => {
            btn.style.transform = 'scale(1.05, 1.05)';
            setTimeout(() => btn.style.transform = 'translate(0,0)', 150);
        });
    });
}

// A4: Shiny Borders (Glassmorphic Glow)
function initShinyBorders() {
    const cards = document.querySelectorAll('.split-card-container, #advanced-controls');

    document.addEventListener('mousemove', (e) => {
        cards.forEach(card => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });
}

// B6: Confetti Success
function triggerConfetti() {
    const count = 100;
    const origin = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.classList.add('confetti'); // Ensure this class is defined in CSS (position fixed, etc)

        // Random properties
        const angle = Math.random() * Math.PI * 2;
        const velocity = 2 + Math.random() * 6;
        const tx = Math.cos(angle) * velocity * 100;
        const ty = Math.sin(angle) * velocity * 100;
        const color = ['#ff0', '#f0f', '#0ff', '#0f0', '#fff'][Math.floor(Math.random() * 5)];

        particle.style.cssText = `
            position: fixed;
            left: ${origin.x}px;
            top: ${origin.y}px;
            width: 6px;
            height: 6px;
            background: ${color};
            border-radius: 50%;
            pointer-events: none;
            z-index: 9999;
            transition: all 1s ease-out;
            opacity: 1;
        `;

        document.body.appendChild(particle);

        // Animate
        requestAnimationFrame(() => {
            particle.style.transform = `translate(${tx}px, ${ty}px) scale(0)`;
            particle.style.opacity = '0';
        });

        // Cleanup
        setTimeout(() => particle.remove(), 1000);
    }
}

// ============================================================================
// CAROUSEL NAVIGATION & PROMPT PROTECTION
// ============================================================================
function checkPromptConflict() {
    if (state.isPromptManuallyEdited) {
        const choice = confirm(
            "You have a custom prompt active.\n\n" +
            "Click OK to DISCARD it and switch styles.\n" +
            "Click CANCEL to keep your prompt."
        );

        if (choice) {
            const oldPrompt = document.getElementById('custom-prompt').value;
            navigator.clipboard.writeText(oldPrompt).then(() => {
                showToast("Old prompt copied to clipboard", "info");
            }).catch(() => { });

            state.isPromptManuallyEdited = false;
            document.getElementById('custom-prompt').value = '';
            return true;
        }
        return false;
    }
    return true;
}

function nextSlide(type) {
    if (!checkPromptConflict()) return;

    if (type === 'genre') {
        state.activeGenreIndex = (state.activeGenreIndex + 1) % GENRES.length;
    } else {
        state.activeStyleIndex = (state.activeStyleIndex + 1) % STYLES.length;
    }
    updateCarouselUI();
}

function prevSlide(type) {
    if (!checkPromptConflict()) return;

    if (type === 'genre') {
        state.activeGenreIndex = (state.activeGenreIndex - 1 + GENRES.length) % GENRES.length;
    } else {
        state.activeStyleIndex = (state.activeStyleIndex - 1 + STYLES.length) % STYLES.length;
    }
    updateCarouselUI();
}

function randomize() {
    state.isPromptManuallyEdited = false;
    const promptInput = document.getElementById('custom-prompt');
    if (promptInput) promptInput.value = '';

    const overlay = document.getElementById('generation-overlay');
    if (overlay && !overlay.classList.contains('hidden')) {
        closeGenerationDisplay();
    }

    const cycles = 5;
    let count = 0;
    const interval = setInterval(() => {
        state.activeGenreIndex = Math.floor(Math.random() * GENRES.length);
        state.activeStyleIndex = Math.floor(Math.random() * STYLES.length);
        updateCarouselUI();
        count++;
        if (count > cycles) clearInterval(interval);
    }, 100);
}

// ============================================================================
// KEYBOARD & GESTURES
// ============================================================================
function initKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

        const overlay = document.getElementById('generation-overlay');
        const isGenerationOverlayOpen = overlay && !overlay.classList.contains('hidden');

        switch (e.key) {
            case 'ArrowLeft': e.preventDefault(); prevSlide('genre'); break;
            case 'ArrowRight': e.preventDefault(); nextSlide('genre'); break;
            case 'ArrowUp': e.preventDefault(); prevSlide('style'); break;
            case 'ArrowDown': e.preventDefault(); nextSlide('style'); break;
            case 'Enter':
                if (!document.getElementById('result-modal').classList.contains('hidden')) return;
                e.preventDefault(); handleGenerate(); break;
            case 'r': case 'R': if (!e.metaKey) { e.preventDefault(); randomize(); } break;
            case 'h': case 'H': if (!e.metaKey) { e.preventDefault(); toggleHistory(); } break;
            case 'v': case 'V': if (isGenerationOverlayOpen) { e.preventDefault(); viewFullResult(); } break;
            case 'd': case 'D': if (isGenerationOverlayOpen) { e.preventDefault(); downloadGenerated(); } break;
            case 'x': case 'X': case 'Escape':
                e.preventDefault();
                if (isGenerationOverlayOpen) closeGenerationDisplay();
                else {
                    closeResult();
                    const drawer = document.getElementById('history-drawer');
                    if (drawer && !drawer.classList.contains('translate-x-full')) toggleHistory();
                }
                break;
        }
    });
}

function initSwipeGestures() {
    const setupSwipe = (elementId, type) => {
        const el = document.getElementById(elementId);
        if (!el) return;
        let touchStartX = 0;
        let touchEndX = 0;

        el.addEventListener('touchstart', e => touchStartX = e.changedTouches[0].screenX, { passive: true });
        el.addEventListener('touchend', e => {
            touchEndX = e.changedTouches[0].screenX;
            if (touchEndX < touchStartX - 50) nextSlide(type);
            if (touchEndX > touchStartX + 50) prevSlide(type);
        }, { passive: true });
    };
    setupSwipe('genre-track', 'genre');
    setupSwipe('style-track', 'style');

    // Add swipe logic for history drawer
    const historyDrawer = document.getElementById('history-drawer');
    if (historyDrawer) {
        let drawerTouchStartX = 0;
        historyDrawer.addEventListener('touchstart', e => drawerTouchStartX = e.changedTouches[0].screenX, { passive: true });
        historyDrawer.addEventListener('touchend', e => {
            const touchEndX = e.changedTouches[0].screenX;
            // If swipe right (from left to right) and drawer is open
            if (historyDrawer.classList.contains('translate-x-0') && touchEndX > drawerTouchStartX + 50) {
                toggleHistory();
            }
        }, { passive: true });
    }
}

function initParallax() {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const container = document.getElementById('tilt-wrapper');
    const card = document.getElementById('main-card');
    if (isMobileDevice() || !container || !card || prefersReducedMotion) return;

    document.addEventListener('mousemove', (e) => {
        const { clientX, clientY } = e;
        const xPos = (clientX / window.innerWidth - 0.5) * 2;
        const yPos = (clientY / window.innerHeight - 0.5) * 2;
        container.style.transform = `rotateX(${yPos * -10}deg) rotateY(${xPos * 10}deg)`;
    });

    document.addEventListener('mouseleave', () => {
        container.style.transform = `rotateX(0deg) rotateY(0deg)`;
    });
}

// ============================================================================
// UI TOGGLES
// ============================================================================
function togglePromptEditor() {
    const area = document.getElementById('custom-prompt');
    if (!area) return;
    area.classList.toggle('hidden');
    if (!area.classList.contains('hidden')) {
        updateCustomPromptPlaceholder();
        area.focus();
    }
}

function copyPrompt() {
    const area = document.getElementById('custom-prompt');
    if (area) copyToClipboard(area.value || area.placeholder);
}

function toggleAspectRatio() {
    state.isDesktopMode = !state.isDesktopMode;
    const btn = document.getElementById('aspect-btn');
    const container = document.getElementById('main-card');
    const w = document.getElementById('width');
    const h = document.getElementById('height');

    if (state.isDesktopMode) {
        btn.innerHTML = '<i data-lucide="monitor" class="text-white w-5 h-5"></i>';
        w.value = APP_CONFIG.DESKTOP_WIDTH;
        h.value = APP_CONFIG.DESKTOP_HEIGHT;
        container.classList.add('desktop-mode');
        showToast('Desktop mode (1920x1080)', 'info', 2000);
    } else {
        btn.innerHTML = '<i data-lucide="smartphone" class="text-white w-5 h-5"></i>';
        w.value = APP_CONFIG.DEFAULT_WIDTH;
        h.value = APP_CONFIG.DEFAULT_HEIGHT;
        container.classList.remove('desktop-mode');
        showToast('Mobile mode (1080x1920)', 'info', 2000);
    }
    if (window.lucide) lucide.createIcons();
}

function setColorBias(color) {
    state.selectedColorBias = color;
    document.querySelectorAll('.color-dot').forEach(dot => dot.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    updateCustomPromptPlaceholder();
}

function setCustomColor() {
    const picker = document.getElementById('custom-color-picker');
    if (picker) {
        state.customColor = picker.value;
        showToast(`Custom color: ${picker.value}`, 'info', 2000);
        updateCustomPromptPlaceholder();
    }
}

function toggleAdvancedControls() {
    state.advancedMode = !state.advancedMode;
    const panel = document.getElementById('advanced-controls');
    if (!panel) return;

    panel.classList.toggle('hidden');

    // Toggle the chevron icon if it exists
    const btn = window.event?.currentTarget;
    if (btn) {
        const icon = btn.querySelector('i');
        if (icon) {
            icon.setAttribute('data-lucide', panel.classList.contains('hidden') ? 'settings' : 'chevron-up');
            if (window.lucide) lucide.createIcons();
        }
    }
}

function updateSeed(value) { state.seed = value ? parseInt(value) : null; }
function updateSteps(value) {
    state.numSteps = parseInt(value);
    document.getElementById('steps-value').textContent = value;
}
function randomSeed() {
    const seed = Math.floor(Math.random() * 1000000);
    document.getElementById('seed-input').value = seed;
    state.seed = seed;
    showToast(`Random seed: ${seed}`, 'info', 2000);
}

// ============================================================================
// UI TOGGLES & VIEWS
// ============================================================================

window.switchView = function (view) {
    state.activeView = view;
    const createView = document.getElementById('tilt-wrapper');
    const controlArea = document.querySelector('.w-full.max-w-md.mt-6'); // Unified Control Area
    const communityView = document.getElementById('community-view');
    const navCreate = document.getElementById('nav-create');
    const navCommunity = document.getElementById('nav-community');

    if (view === 'create') {
        createView?.classList.remove('hidden');
        controlArea?.classList.remove('hidden');
        communityView?.classList.add('hidden');

        // Desktop Nav
        if (navCreate) navCreate.className = 'px-4 py-1.5 rounded-full text-xs font-bold transition-all bg-white text-black';
        if (navCommunity) navCommunity.className = 'px-4 py-1.5 rounded-full text-xs font-bold transition-all text-gray-400 hover:text-white';

        // Mobile Nav
        document.getElementById('mobile-nav-create')?.classList.replace('text-gray-400', 'text-white');
        document.getElementById('mobile-nav-community')?.classList.replace('text-white', 'text-gray-400');
    } else {
        createView?.classList.add('hidden');
        controlArea?.classList.add('hidden');
        communityView?.classList.remove('hidden');

        // Desktop Nav
        if (navCreate) navCreate.className = 'px-4 py-1.5 rounded-full text-xs font-bold transition-all text-gray-400 hover:text-white';
        if (navCommunity) navCommunity.className = 'px-4 py-1.5 rounded-full text-xs font-bold transition-all bg-white text-black';

        // Mobile Nav
        document.getElementById('mobile-nav-community')?.classList.replace('text-gray-400', 'text-white');
        document.getElementById('mobile-nav-create')?.classList.replace('text-white', 'text-gray-400');

        renderCommunity();
    }
    if (window.lucide) lucide.createIcons();
};

window.toggleAuthModal = function () {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    modal.classList.toggle('hidden');

    // Mobile Nav sync
    const mobileNav = document.getElementById('mobile-nav');
    if (!modal.classList.contains('hidden')) {
        mobileNav?.classList.add('translate-y-full');
    } else {
        mobileNav?.classList.remove('translate-y-full');
    }

    // If opening and user is logged in, show profile
    if (!modal.classList.contains('hidden') && state.currentUser) {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('signup-form').classList.add('hidden');
        document.getElementById('profile-form').classList.remove('hidden');

        // Populate profile
        document.getElementById('profile-email').innerText = state.currentUser.email;
        document.getElementById('profile-username').value = state.currentUser.user_metadata?.username || '';
        document.getElementById('profile-avatar-url').value = state.currentUser.user_metadata?.avatar_url || '';
        if (state.currentUser.user_metadata?.avatar_url) {
            document.getElementById('profile-avatar').src = state.currentUser.user_metadata.avatar_url;
        }

        // Refresh credits UI
        db.checkAndResetCredits(state.currentUser.id).then(credits => {
            const display = document.getElementById('user-credits-display');
            if (display) display.innerText = `Credits: ${credits}/100`;
        });
    }
};

window.switchAuthMode = function (mode) {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    if (mode === 'signup') {
        loginForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
    } else {
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
    }
};

window.handleAuthSubmit = async function (type) {
    try {
        if (type === 'signup') {
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;
            const username = document.getElementById('reg-username').value;
            await auth.signUpUser(email, password, username);
            showToast('Check your email for confirmation!', 'info');
        } else {
            const email = document.getElementById('auth-email').value;
            const password = document.getElementById('auth-password').value;
            await auth.signInUser(email, password);
            showToast('Welcome back!', 'success');
        }
        toggleAuthModal();
    } catch (e) {
        showToast(e.message, 'error');
    }
};

function handleUserLogin(user) {
    state.currentUser = user;
    const userBtn = document.getElementById('user-btn');
    if (userBtn) {
        // Priority: Auth Metadata > Fallback Default
        const avatarUrl = user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${user.user_metadata?.username || user.email}&background=random`;
        userBtn.innerHTML = `<img src="${avatarUrl}" class="w-full h-full rounded-full object-cover">`;
        userBtn.onclick = toggleAuthModal;
        userBtn.title = `My Account (${user.email})`;
    }
    syncLocalToCloud();

    // Refresh credits UI
    db.checkAndResetCredits(user.id).then(credits => {
        const display = document.getElementById('user-credits-display');
        if (display) display.innerText = `Credits: ${credits}/100`;
    });
}

function handleUserLogout() {
    state.currentUser = null;
    const userBtn = document.getElementById('user-btn');
    if (userBtn) {
        userBtn.innerHTML = '<i data-lucide="user" class="text-white"></i>';
        userBtn.onclick = toggleAuthModal;
        userBtn.title = "My Account";
        if (window.lucide) lucide.createIcons();
    }
    showToast('Signed out', 'info');
}

window.handleLogOut = async function () {
    if (confirm('Are you sure you want to sign out?')) {
        await auth.signOutUser();
        toggleAuthModal();
    }
};

window.handleAvatarUpload = async function (event) {
    const file = event.target.files[0];
    if (!file || !state.currentUser) return;

    try {
        showToast('Uploading avatar...', 'info');
        const publicUrl = await db.uploadAvatar(state.currentUser.id, file);
        document.getElementById('profile-avatar-url').value = publicUrl;
        document.getElementById('profile-avatar').src = publicUrl;
        showToast('Avatar uploaded! Click Save to apply.', 'success');
    } catch (e) {
        console.error(e);
        showToast('Upload failed: ' + e.message, 'error');
    }
};

window.updateProfile = async function () {
    if (!state.currentUser) return;

    const username = document.getElementById('profile-username').value;
    const avatarUrl = document.getElementById('profile-avatar-url').value;

    try {
        showToast('Saving changes...', 'info');
        await db.updateProfile(state.currentUser.id, {
            username: username,
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString()
        });

        // Update local user state metadata (Supabase auth user metadata is separate from public.profiles table usually, 
        // but for this app we'll assume they sync or we just refresh)
        state.currentUser.user_metadata = { ...state.currentUser.user_metadata, username, avatar_url: avatarUrl };

        handleUserLogin(state.currentUser); // Refresh UI
        showToast('Profile updated!', 'success');
    } catch (e) {
        console.error(e);
        showToast('Update failed: ' + e.message, 'error');
    }
};

window.updateDeviceRatio = function (preset) {
    const wInput = document.getElementById('width');
    const hInput = document.getElementById('height');
    const presets = {
        iphone: { w: 1284, h: 2778 },
        macbook: { w: 2560, h: 1600 },
        desktop: { w: 1920, h: 1080 },
        square: { w: 1024, h: 1024 },
        ultrawide: { w: 3440, h: 1440 }
    };
    const choice = presets[preset] || presets.desktop;
    wInput.value = choice.w;
    hInput.value = choice.h;
    showToast(`Ratio set for ${preset}`, 'info', 1000);
};

window.toggleBatchMode = function () {
    state.batchMode = !state.batchMode;
    const btn = document.getElementById('batch-toggle');
    const select = document.getElementById('batch-count');
    if (state.batchMode) {
        btn.classList.add('bg-white', 'text-black');
        btn.classList.remove('bg-white/5', 'text-white');
        select.value = "4";
        showToast('Batch mode: 4 variations', 'info');
    } else {
        btn.classList.remove('bg-white', 'text-black');
        btn.classList.add('bg-white/5', 'text-white');
        select.value = "1";
        showToast('Standard mode: Single image', 'info');
    }
};

// ============================================================================
// HISTORY & FAVORITES
// ============================================================================
const historyObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
            setTimeout(() => entry.target.classList.add('reveal'), index * 50);
            historyObserver.unobserve(entry.target);
        }
    });
}, { root: document.getElementById('history-drawer'), threshold: 0.1 });

window.setHistoryFilter = function (filter) {
    state.historyFilter = filter;
    const tabAll = document.getElementById('tab-all');
    const tabFav = document.getElementById('tab-favorites');

    // Toggle logic
    const activeClass = "flex-1 py-2.5 text-sm font-bold rounded-lg bg-white text-black shadow-lg flex items-center justify-center gap-2";
    const inactiveClass = "flex-1 py-2.5 text-sm font-bold rounded-lg text-gray-400 hover:text-white flex items-center justify-center gap-2";

    if (filter === 'all') {
        tabAll.className = activeClass; tabFav.className = inactiveClass;
    } else {
        tabAll.className = inactiveClass; tabFav.className = activeClass;
    }
    renderHistory();
}

function toggleHistory() {
    const drawer = document.getElementById('history-drawer');
    const overlay = document.getElementById('history-overlay');
    if (drawer.classList.contains('translate-x-full')) {
        drawer.classList.remove('translate-x-full');
        overlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        document.getElementById('mobile-nav')?.classList.add('translate-y-full');
    } else {
        drawer.classList.add('translate-x-full');
        overlay.classList.add('hidden');
        document.body.style.overflow = '';
        document.getElementById('mobile-nav')?.classList.remove('translate-y-full');
    }
}

function saveToHistory(url, genreName, styleName, prompt, seed) {
    const history = JSON.parse(localStorage.getItem('wallpaper_history') || '[]');
    const newItem = { url, genre: genreName, style: styleName, prompt, seed, date: new Date().toLocaleString(), timestamp: Date.now() };
    history.unshift(newItem);
    if (history.length > APP_CONFIG.MAX_HISTORY_ITEMS) history.pop();
    localStorage.setItem('wallpaper_history', JSON.stringify(history));
    renderHistory();
}

function clearHistory() {
    if (confirm('Clear history? Favorites will be kept.')) {
        localStorage.removeItem('wallpaper_history');
        renderHistory();
        showToast('History cleared', 'success');
    }
}

// In app.js, replace the renderHistory function with this:

function renderHistory() {
    let history = JSON.parse(localStorage.getItem('wallpaper_history') || '[]');
    const mobileList = document.getElementById('history-list');
    const desktopList = document.getElementById('desktop-history-list');

    historyObserver.disconnect();

    const renderToList = (list, historyItems) => {
        if (!list) return;
        list.innerHTML = '';

        if (historyItems.length === 0) {
            list.innerHTML = `
                <div class="flex flex-col items-center justify-center p-12 text-gray-500 opacity-50 col-span-full">
                    <i data-lucide="image" class="w-12 h-12 mb-4 opacity-50"></i>
                    <p>No wallpapers found.</p>
                </div>`;
            return;
        }

        historyItems.forEach((item) => {
            const isFav = state.favorites.includes(item.url);
            const card = document.createElement('div');
            card.className = 'history-card reveal';

            card.innerHTML = `
                <img src="${item.url}" class="history-card-img" loading="lazy" onclick="showResult('${item.url}', ${item.seed || 'null'})">
                <div class="overlay-info">
                    <span class="overlay-title">${item.genre}</span>
                </div>
                <button onclick="event.stopPropagation(); toggleFavorite('${item.url}')" class="history-fav-btn ${isFav ? 'active' : ''}">
                    <i data-lucide="star" class="w-4 h-4 ${isFav ? 'fill-current' : ''}"></i>
                </button>
                <div class="history-actions-overlay">
                    <div class="history-btn-group">
                        <button onclick="event.stopPropagation(); remixImage('${item.timestamp}')" class="catalog-btn" title="Remix">
                            <i data-lucide="shuffle"></i>
                        </button>
                        <button onclick="event.stopPropagation(); showResult('${item.url}', ${item.seed})" class="catalog-btn" title="View">
                            <i data-lucide="eye"></i>
                        </button>
                        <button onclick="event.stopPropagation(); downloadImageDirect('${item.url}')" class="catalog-btn" title="Download">
                            <i data-lucide="download"></i>
                        </button>
                        <button onclick="event.stopPropagation(); publishHistoryItem('${item.timestamp}')" class="catalog-btn" title="Post to Community">
                            <i data-lucide="upload-cloud"></i>
                        </button>
                        <button onclick="event.stopPropagation(); deleteHistoryItem('${item.timestamp}')" class="catalog-btn btn-delete" title="Delete">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </div>
            `;
            list.appendChild(card);
            historyObserver.observe(card);
        });
    };

    let filteredHistory = history;
    if (state.historyFilter === 'favorites') {
        filteredHistory = history.filter(item => state.favorites.includes(item.url));
    }

    renderToList(mobileList, filteredHistory);
    renderToList(desktopList, filteredHistory);

    if (window.lucide) lucide.createIcons();
}
function deleteHistoryItem(timestamp) {
    let history = JSON.parse(localStorage.getItem('wallpaper_history') || '[]');
    history = history.filter(item => item.timestamp !== Number(timestamp));
    localStorage.setItem('wallpaper_history', JSON.stringify(history));
    renderHistory();
}

function toggleFavorite(url) {
    const index = state.favorites.indexOf(url);
    if (index > -1) state.favorites.splice(index, 1);
    else state.favorites.push(url);
    localStorage.setItem('wallpaper_favorites', JSON.stringify(state.favorites));
    renderHistory();
    renderFavorites();
}

function renderFavorites() {
    const count = state.favorites.length;
    const badge = document.getElementById('favorites-badge');
    if (badge) {
        badge.textContent = count;
        badge.classList.toggle('hidden', count === 0);
    }
}

// 2B: Remix
window.remixImage = async function (idOrTimestamp, fromCommunity = false) {
    let item;

    if (fromCommunity) {
        try {
            item = await db.fetchWallpaperById(idOrTimestamp);
        } catch (e) {
            console.error(e);
            showToast("Failed to fetch remix data", "error");
            return;
        }
    } else {
        const history = JSON.parse(localStorage.getItem('wallpaper_history') || '[]');
        item = history.find(i => i.timestamp === Number(idOrTimestamp) || i.url === idOrTimestamp || i.id === idOrTimestamp);
    }

    if (!item) return;

    const genreIndex = GENRES.findIndex(g => g.name === item.genre);
    if (genreIndex !== -1) state.activeGenreIndex = genreIndex;
    const styleIndex = STYLES.findIndex(s => s.name === item.style);
    if (styleIndex !== -1) state.activeStyleIndex = styleIndex;

    if (item.seed) {
        state.seed = item.seed;
        const seedInput = document.getElementById('seed-input');
        if (seedInput) seedInput.value = item.seed;
    }

    if (item.prompt) {
        state.isPromptManuallyEdited = true;
        const promptInput = document.getElementById('custom-prompt');
        if (promptInput) promptInput.value = item.prompt;
    }

    updateCarouselUI();
    if (!fromCommunity) toggleHistory();
    else switchView('create');

    showToast("Settings restored!", "success");
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ============================================================================
// MODALS & RESULTS (Featuring Category C: Color Palette)
// ============================================================================
function toggleLockScreen() {
    document.getElementById('lock-screen-overlay').classList.toggle('hidden');
}

function updateTime() {
    const now = new Date();
    const timeEl = document.getElementById('lock-time');
    const dateEl = document.getElementById('lock-date');
    if (timeEl) timeEl.innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (dateEl) dateEl.innerText = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    setTimeout(updateTime, 1000);
}

function showResult(url, seed = null, wallpaperId = null) {
    const modal = document.getElementById('result-modal');
    const img = document.getElementById('result-image');
    const link = document.getElementById('download-link');
    const seedDisplay = document.getElementById('result-seed');

    img.src = url;
    link.href = url;
    if (seedDisplay && seed) {
        seedDisplay.textContent = `Seed: ${seed}`;
        seedDisplay.classList.remove('hidden');
    }

    if (wallpaperId) {
        db.incrementViews(wallpaperId);
    }
    document.getElementById('lock-screen-overlay').classList.add('hidden');
    modal.classList.remove('hidden');
    document.getElementById('mobile-nav')?.classList.add('translate-y-full');

    // Category C: Extract Colors when image is loaded
    // Need to handle CORS if loading from external URL

    img.onload = () => extractColors(img);
}

// Category C: Color Extraction Logic
function extractColors(imgElement) {
    try {
        let paletteContainer = document.getElementById('color-palette-container');
        if (!paletteContainer) {
            const resultModalContent = document.querySelector('#result-modal .flex-col.gap-3');
            if (resultModalContent) {
                paletteContainer = document.createElement('div');
                paletteContainer.id = 'color-palette-container';
                paletteContainer.className = 'flex justify-center gap-2 mt-2';
                resultModalContent.insertBefore(paletteContainer, resultModalContent.firstChild);
            } else {
                return;
            }
        }

        paletteContainer.innerHTML = '';

        if (window.ColorThief) {
            const colorThief = new ColorThief();
            const palette = colorThief.getPalette(imgElement, 5);

            // Adaptive UI: Set modal background color to match the dominant color
            const dom = palette[0];
            const resultModal = document.getElementById('result-modal');
            if (resultModal) {
                resultModal.style.background = `radial-gradient(circle at center, rgba(${dom[0]}, ${dom[1]}, ${dom[2]}, 0.8), #000)`;
            }

            palette.forEach(rgb => {
                const hex = "#" + ((1 << 24) + (rgb[0] << 16) + (rgb[1] << 8) + rgb[2]).toString(16).slice(1).toUpperCase();

                const dot = document.createElement('div');
                dot.className = "w-8 h-8 rounded-full cursor-pointer hover:scale-125 transition-transform border border-white/20 shadow-lg";
                dot.style.backgroundColor = hex;
                dot.title = `Copy ${hex}`;
                dot.onclick = () => {
                    copyToClipboard(hex);
                    showToast(`Copied ${hex}`, 'info', 1000);
                };
                paletteContainer.appendChild(dot);
            });
        }
    } catch (e) {
        console.warn("Color extraction failed:", e);
    }
}

function closeResult() {
    document.getElementById('result-modal').classList.add('hidden');
    document.getElementById('mobile-nav')?.classList.remove('translate-y-full');
}

// ============================================================================
// API & GENERATION (Featuring B6: Confetti)
// ============================================================================
async function handleGenerate() {
    const genre = GENRES[state.activeGenreIndex];
    const style = STYLES[state.activeStyleIndex];
    const promptInput = document.getElementById('custom-prompt');
    const batchCount = parseInt(document.getElementById('batch-count')?.value || '1');

    // Intelligent "Surprise Me"
    let finalPrompt = promptInput?.value;
    if (!finalPrompt) {
        finalPrompt = `${genre.prompt}, ${style.prompt}. wallpaper.`;
        if (typeof RANDOM_MODIFIERS !== 'undefined' && RANDOM_MODIFIERS.length > 0) {
            const mod = RANDOM_MODIFIERS[Math.floor(Math.random() * RANDOM_MODIFIERS.length)];
            finalPrompt += `, ${mod}`;
        }
    }

    const w = parseInt(document.getElementById('width').value);
    const h = parseInt(document.getElementById('height').value);
    const seed = state.seed || Math.floor(Math.random() * 1000000);

    const overlay = document.getElementById('generation-overlay');
    const canvas = document.getElementById('webgl-generation-canvas');
    const statusDiv = document.getElementById('generation-status');
    const resultImage = document.getElementById('generation-result-image');
    const actions = document.getElementById('generation-actions');
    const progressBar = document.getElementById('generation-progress-bar');
    const loadingText = document.getElementById('loading-text');

    // CREDIT CHECK
    if (state.currentUser) {
        try {
            const currentCredits = await db.checkAndResetCredits(state.currentUser.id);
            const totalRequired = batchCount * 10;
            if (currentCredits < totalRequired) {
                showToast(`Insufficient credits! Need ${totalRequired}, have ${currentCredits}`, 'error');
                return;
            }
        } catch (e) {
            console.error('Credit check failed:', e);
            // Allow proceed if cloud check fails? No, safer to block if we want to enforce.
        }
    }

    const updateProgress = (pct, text) => {
        if (progressBar) progressBar.style.width = `${pct}%`;
        if (loadingText) loadingText.innerText = text;
    };

    document.getElementById('main-card').classList.add('generating-active');
    overlay.classList.remove('hidden');
    canvas.classList.remove('hidden');
    statusDiv.classList.remove('hidden');
    resultImage.classList.add('hidden');
    resultImage.classList.remove('reveal-active');
    actions.classList.add('hidden');

    canvas.style.opacity = '1';
    statusDiv.style.opacity = '1';

    updateProgress(30, "Step 1/3: Analyzing prompt and configuration...");
    initGenerationAnimation();

    try {
        const apiUrl = (API_CONFIG.BASE_URL.endsWith('/') ? API_CONFIG.BASE_URL.slice(0, -1) : API_CONFIG.BASE_URL) + API_CONFIG.GENERATION_ENDPOINT;
        let finalData = null;

        updateProgress(65, `Step 2/3: Generating ${batchCount > 1 ? batchCount + ' variations' : 'wallpaper'}...`);

        // Batch Generation Logic
        const generateSingle = async (currentSeed) => {
            for (let i = 0; i < API_CONFIG.MAX_RETRIES; i++) {
                try {
                    const response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ prompt: finalPrompt, width: w, height: h, num_steps: state.numSteps, seed: currentSeed })
                    });
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return await response.json();
                } catch (e) {
                    if (i === API_CONFIG.MAX_RETRIES - 1) throw e;
                    await new Promise(r => setTimeout(r, API_CONFIG.RETRY_DELAY));
                }
            }
        };

        if (batchCount > 1) {
            const promises = Array.from({ length: batchCount }, (_, i) => generateSingle(seed + i));
            const results = await Promise.all(promises);
            finalData = { output: results.map(r => r.output), isBatch: true };
        } else {
            const result = await generateSingle(seed);
            finalData = { output: result.output, isBatch: false };
        }

        if (finalData && finalData.output) {
            updateProgress(90, "Step 3/3: Finalizing and preparing results...");

            setTimeout(async () => {
                updateProgress(100, "Success");
                stopGenerationAnimation();
                triggerConfetti();

                canvas.style.opacity = '0';
                statusDiv.style.opacity = '0';

                setTimeout(async () => {
                    canvas.classList.add('hidden');
                    statusDiv.classList.add('hidden');

                    if (finalData.isBatch) {
                        // Display Batch Grid
                        resultImage.classList.add('hidden');
                        const grid = document.createElement('div');
                        grid.id = 'batch-grid-result';
                        grid.className = 'batch-grid reveal-active';
                        finalData.output.forEach(url => {
                            const img = document.createElement('img');
                            img.src = url;
                            img.className = 'batch-grid-item';
                            img.onclick = () => showResult(url, seed, true);
                            grid.appendChild(img);
                        });
                        resultImage.parentNode.insertBefore(grid, resultImage);
                        window.currentGeneratedImage = finalData.output[0]; // Use first for main actions
                    } else {
                        // Display Single Image
                        const oldGrid = document.getElementById('batch-grid-result');
                        if (oldGrid) oldGrid.remove();
                        resultImage.src = finalData.output;
                        resultImage.classList.remove('hidden');
                        resultImage.classList.add('reveal-active');
                        window.currentGeneratedImage = finalData.output;
                    }

                    actions.classList.remove('hidden');
                    if (window.lucide) lucide.createIcons();
                    setTimeout(() => { if (progressBar) progressBar.style.width = '0%'; }, 500);
                }, 500);

                window.currentGeneratedSeed = seed;

                // DEDUCT CREDITS
                if (state.currentUser) {
                    try {
                        await db.deductCredits(state.currentUser.id, batchCount * 10);
                        const newCredits = await db.checkAndResetCredits(state.currentUser.id);
                        showToast(`Credits remaining: ${newCredits}`, 'info');
                    } catch (e) {
                        console.error('Credit deduction failed:', e);
                    }
                }

                // SAVE TO SUPABASE IF LOGGED IN
                if (state.currentUser) {
                    const outputs = Array.isArray(finalData.output) ? finalData.output : [finalData.output];
                    for (const url of outputs) {
                        try {
                            await db.saveWallpaperToDB({
                                user_id: state.currentUser.id,
                                url: url,
                                prompt: finalPrompt,
                                genre: genre.name,
                                style: style.name,
                                seed: seed,
                                is_public: false
                            });
                        } catch (e) {
                            console.error('Failed to save to cloud:', e);
                        }
                    }
                }

                saveToHistory(Array.isArray(finalData.output) ? finalData.output[0] : finalData.output, genre.name, style.name, finalPrompt, seed);
                showToast(batchCount > 1 ? `Generated ${batchCount} variations!` : 'Wallpaper created!', 'success');
            }, 500);
        }
    } catch (error) {
        console.error(error);
        stopGenerationAnimation();
        closeGenerationDisplay();
        showToast('Generation failed. Check settings.', 'error');
    }
}

async function handleBatchGenerate() {
    const count = parseInt(document.getElementById('batch-count')?.value) || 4;
    // Just a UI trigger, actual logic is in handleGenerate
    showToast(`Generating ${count} variations...`, 'info', 2000);
}

// ============================================================================
// WEBGL & ANIMATION
// ============================================================================
function initWebGL() {
    const canvas = document.getElementById('webgl-canvas');
    if (!canvas) return;
    if (!window.WebGLRenderingContext) { enableFallbackMode(); return; }

    // Check for prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    try {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.position.z = 5;

        const particleCount = isMobileDevice() ? APP_CONFIG.WEBGL_PARTICLE_COUNT_MOBILE : APP_CONFIG.WEBGL_PARTICLE_COUNT;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        for (let i = 0; i < particleCount * 3; i++) positions[i] = (Math.random() - 0.5) * 20;
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        particleMaterial = new THREE.PointsMaterial({ color: 0x444444, size: 0.05, transparent: true, opacity: 0.6 });
        const particles = new THREE.Points(geometry, particleMaterial);
        scene.add(particles);

        function animate() {
            requestAnimationFrame(animate);
            // Smart Throttling
            const overlay = document.getElementById('generation-overlay');
            const drawer = document.getElementById('history-drawer');
            if ((overlay && !overlay.classList.contains('hidden')) ||
                (drawer && drawer.classList.contains('translate-x-0')) ||
                prefersReducedMotion) {
                return;
            }

            if (particleMaterial) particleMaterial.color.lerp(targetColor, 0.05); // Color tween
            particles.rotation.y += 0.0005;
            particles.position.y += Math.sin(Date.now() * 0.001) * 0.002;
            renderer.render(scene, camera);
        }
        animate();
        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    } catch (e) { enableFallbackMode(); }
}

function enableFallbackMode() {
    document.body.classList.add('fallback-active');
    const canvas = document.getElementById('webgl-canvas');
    if (canvas) canvas.style.display = 'none';
}

// ... (Generation Animation Code) ...
let generationScene = null, generationCamera = null, generationRenderer = null, generationAnimationId = null;

function initGenerationAnimation() {
    const canvas = document.getElementById('webgl-generation-canvas');
    const container = document.getElementById('main-card');
    if (!canvas || !container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;

    generationScene = new THREE.Scene();
    generationCamera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    generationRenderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    generationRenderer.setSize(width, height);
    generationCamera.position.z = 15;

    const pixelCount = 3000;
    const pixelGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(pixelCount * 3);
    for (let i = 0; i < pixelCount * 3; i++) positions[i] = (Math.random() - 0.5) * 20;
    pixelGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const pixelMaterial = new THREE.PointsMaterial({ size: 0.12, color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending });
    const pixelSystem = new THREE.Points(pixelGeometry, pixelMaterial);
    generationScene.add(pixelSystem);

    let startTime = Date.now();
    function animate() {
        generationAnimationId = requestAnimationFrame(animate);
        const elapsed = (Date.now() - startTime) * 0.001;
        pixelSystem.rotation.y = elapsed * 0.03;
        generationRenderer.render(generationScene, generationCamera);
    }
    animate();
}

function stopGenerationAnimation() {
    if (generationAnimationId) cancelAnimationFrame(generationAnimationId);
    if (generationRenderer) generationRenderer.dispose();
    generationScene = null;
}

function closeGenerationDisplay() {
    stopGenerationAnimation();
    document.getElementById('generation-overlay').classList.add('hidden');
    document.getElementById('main-card').classList.remove('generating-active');
    document.getElementById('generation-result-image').src = '';
}

function viewFullResult() {
    if (window.currentGeneratedImage) {
        showResult(window.currentGeneratedImage, window.currentGeneratedSeed);
        closeGenerationDisplay();
    }
}

async function downloadGenerated() {
    if (window.currentGeneratedImage) await downloadImageDirect(window.currentGeneratedImage);
}

function toggleShareMenu() { document.getElementById('share-menu').classList.toggle('active'); }
async function shareImage(platform) {
    const url = document.getElementById('result-image').src;
    if (!url) return showToast('No image', 'error');
    if (platform === 'copy') {
        copyToClipboard(url);
    } else if (platform === 'download') {
        downloadImageDirect(url);
    } else if (platform === 'twitter') {
        window.open(`https://twitter.com/intent/tweet?text=Check%20out%20this%20AI%20Wallpaper!&url=${encodeURIComponent(url)}`, '_blank');
    }
}

async function downloadImageDirect(url) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `wallpaper-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
        showToast('Download started', 'success');
    } catch (e) { showToast('Download failed', 'error'); }
}

// Export
window.nextSlide = nextSlide;
window.prevSlide = prevSlide;
window.randomize = randomize;
window.togglePromptEditor = togglePromptEditor;
window.copyPrompt = copyPrompt;
window.toggleAspectRatio = toggleAspectRatio;
window.setColorBias = setColorBias;
window.setCustomColor = setCustomColor;
window.toggleAdvancedControls = toggleAdvancedControls;
window.updateSeed = updateSeed;
window.updateSteps = updateSteps;
window.randomSeed = randomSeed;
window.toggleHistory = toggleHistory;
window.deleteHistoryItem = deleteHistoryItem;
window.clearHistory = clearHistory;
window.toggleFavorite = toggleFavorite;
window.toggleLockScreen = toggleLockScreen;
window.handleGenerate = handleGenerate;
window.handleBatchGenerate = handleBatchGenerate;
window.showResult = showResult;
window.closeResult = closeResult;
window.toggleShareMenu = toggleShareMenu;
window.shareImage = shareImage;
window.closeGenerationDisplay = closeGenerationDisplay;
window.viewFullResult = viewFullResult;
window.downloadGenerated = downloadGenerated;
window.downloadImageDirect = downloadImageDirect;
window.remixImage = remixImage;
window.downloadFromModal = async function () {
    const url = document.getElementById('result-image').src;
    if (url) await downloadImageDirect(url);

};
// ============================================================================
// CLOUD SYNC & COMMUNITY
// ============================================================================

const COMMUNITY_PAGE_SIZE = 24;

window.setCommunitySource = function (source) {
    if (source === 'following' && !state.currentUser) {
        showToast('Sign in to browse your following feed', 'info');
        toggleAuthModal();
        return;
    }
    state.communitySource = source;

    // Update UI tabs
    const btnAll = document.getElementById('source-all');
    const btnFol = document.getElementById('source-following');
    const filters = document.getElementById('community-sort-filters');

    if (source === 'all') {
        btnAll.className = 'px-5 py-2 rounded-full text-xs font-bold transition-all bg-white text-black shadow-lg';
        btnFol.className = 'px-5 py-2 rounded-full text-xs font-bold transition-all text-gray-400 hover:text-white';
        if (filters) filters.classList.remove('hidden');
    } else {
        btnFol.className = 'px-5 py-2 rounded-full text-xs font-bold transition-all bg-white text-black shadow-lg';
        btnAll.className = 'px-5 py-2 rounded-full text-xs font-bold transition-all text-gray-400 hover:text-white';
        if (filters) filters.classList.add('hidden');
    }

    renderCommunity();
};

async function renderCommunity(filterType = 'all', searchQuery = '', isAppend = false, creatorId = null) {
    const grid = document.getElementById('community-grid');
    const loader = document.getElementById('community-loader');
    if (!grid) return;

    if (!isAppend) {
        state.communityPage = 0;
        state.hasMoreCommunity = true;
        grid.innerHTML = '';
        for (let i = 0; i < 8; i++) {
            grid.innerHTML += `<div class="skeleton-card skeleton aspect-[4/5] rounded-xl"></div>`; // Adjusted for mobile feed
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (state.isLoadingCommunity || !state.hasMoreCommunity) return;
    state.isLoadingCommunity = true;
    if (loader) loader.classList.remove('hidden');

    try {
        const currentUserId = state.currentUser ? state.currentUser.id : null;
        const offset = state.communityPage * COMMUNITY_PAGE_SIZE;
        let wallpapers;

        // Map filter to backend sort
        // 'top' in UI -> 'trending' for backend (Views + Likes logic or just Views for now)
        let sort = 'new';
        if (filterType === 'top') sort = 'trending';

        if (creatorId) {
            wallpapers = await db.fetchUserWallpapers(creatorId);
            state.hasMoreCommunity = false;
        } else if (state.communitySource === 'following') {
            wallpapers = await db.fetchFollowingWallpapers(currentUserId, offset, COMMUNITY_PAGE_SIZE);
        } else {
            wallpapers = await db.fetchCommunityWallpapers(currentUserId, offset, COMMUNITY_PAGE_SIZE, sort);
        }

        if (wallpapers.length < COMMUNITY_PAGE_SIZE || creatorId) {
            state.hasMoreCommunity = false;
        }

        // Client-side filtering if needed (mostly for search)
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            wallpapers = wallpapers.filter(w =>
                (w.prompt && w.prompt.toLowerCase().includes(q)) ||
                (w.genre && w.genre.toLowerCase().includes(q)) ||
                (w.style && w.style.toLowerCase().includes(q))
            );
        }

        if (!isAppend) grid.innerHTML = '';

        if (!wallpapers || wallpapers.length === 0) {
            if (!isAppend) grid.innerHTML = '<div class="col-span-full py-20 text-center text-gray-500">No wallpapers found.</div>';
            return;
        }

        wallpapers.forEach((wp, index) => {
            const card = document.createElement('div');
            // Unified Card Design (Responsive via CSS)
            // Mobile: Full width, Instagram style. Desktop: Compact grid.
            card.className = 'history-card reveal cursor-pointer group shadow-2xl bg-black/20 overflow-hidden';

            // Format numbers
            const formatCount = (n) => n >= 1000 ? (n / 1000).toFixed(1) + 'k' : (n || 0);

            card.innerHTML = `
                <div class="w-full h-full bg-gray-800 animate-pulse absolute inset-0 z-0"></div>
                <img src="${wp.url}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 relative z-10" 
                    onload="this.previousElementSibling.remove(); this.classList.add('opacity-100')"
                    onerror="this.src='https://placehold.co/600x800?text=Image+Failed'; this.classList.remove('opacity-0')"
                    onclick="showResult('${wp.url}', ${wp.seed}, '${wp.id}')">
                
                <!-- Overlay Gradient -->
                <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-60 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

                <!-- Author Header (Mobile Visible, Desktop on Hover) -->
                <div class="absolute top-0 left-0 right-0 p-3 flex items-center justify-between opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 bg-gradient-to-b from-black/60 to-transparent sm:bg-none">
                    <div class="flex items-center gap-2 cursor-pointer" onclick="event.stopPropagation(); filterByCreator('${wp.user_id}', '${wp.author_name}')">
                        <div class="w-8 h-8 rounded-full border border-white/20 overflow-hidden bg-white/10">
                            <img src="${wp.author_avatar || `https://ui-avatars.com/api/?name=${wp.author_name}&background=random`}" 
                                class="w-full h-full object-cover"
                                onerror="this.src='https://ui-avatars.com/api/?name=${wp.author_name || 'User'}&background=random'">
                        </div>
                        <span class="text-xs font-bold text-white shadow-black drop-shadow-md">@${wp.author_name}</span>
                    </div>
                     ${(wp.user_id && state.currentUser && wp.user_id !== state.currentUser.id) ? `
                        <button onclick="event.stopPropagation(); handleToggleFollow('${wp.user_id}', '${wp.author_name}')"
                            class="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-bold text-white hover:bg-white hover:text-black transition">
                            Follow
                        </button>` : ''}
                </div>

                <!-- Footer Stats & Actions -->
                <div class="absolute bottom-0 left-0 right-0 p-4 transform sm:translate-y-4 group-hover:translate-y-0 transition-transform duration-300 z-10">
                    <p class="text-xs text-white/90 line-clamp-1 mb-3 italic font-medium">"${wp.prompt}"</p>
                    
                    <div class="flex items-center justify-between">
                         <div class="flex items-center gap-4">
                            <!-- Like -->
                            <button onclick="event.stopPropagation(); handleToggleLike('${wp.id}')" 
                                id="like-btn-${wp.id}"
                                class="flex items-center gap-1.5 transition group/like">
                                <i data-lucide="heart" class="w-5 h-5 transition-transform group-active/like:scale-125 ${wp.is_liked ? 'fill-red-500 text-red-500' : 'text-white hover:text-pink-400'}"></i>
                                <span class="text-xs font-bold text-white">${formatCount(wp.likes_count)}</span>
                            </button>
                            
                            <!-- Views (Read Only) -->
                            <div class="flex items-center gap-1.5 text-white/70">
                                <i data-lucide="eye" class="w-4 h-4"></i>
                                <span class="text-xs font-bold">${formatCount(wp.views_count)}</span>
                            </div>
                        </div>

                        <div class="flex gap-2">
                            <button onclick="event.stopPropagation(); remixImage('${wp.id}', true)" class="p-2 bg-white/10 rounded-full hover:bg-white/20 text-white backdrop-blur-sm transition">
                                <i data-lucide="shuffle" class="w-4 h-4"></i>
                            </button>
                            <button onclick="event.stopPropagation(); downloadImageDirect('${wp.url}')" class="p-2 bg-white/10 rounded-full hover:bg-white/20 text-white backdrop-blur-sm transition">
                                <i data-lucide="download" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
        state.communityPage++;
        if (window.lucide) lucide.createIcons();
    } catch (e) {
        console.error(e);
        showToast('Failed to load community feed', 'error');
    } finally {
        state.isLoadingCommunity = false;
        if (loader) loader.classList.add('hidden');
    }
}

window.handleToggleLike = async function (wallpaperId) {
    if (!state.currentUser) {
        showToast('Sign in to like wallpapers!', 'info');
        toggleAuthModal();
        return;
    }

    const btn = document.getElementById(`like-btn-${wallpaperId}`);
    if (!btn) return;

    const heartIcon = btn.querySelector('i');
    const countSpan = btn.querySelector('span');
    let currentCount = parseInt(countSpan.innerText);

    try {
        // Optimistic UI update
        const isLiking = !btn.classList.contains('bg-red-500');
        if (isLiking) {
            btn.classList.remove('bg-black/30', 'hover:bg-white/20');
            btn.classList.add('bg-red-500', 'scale-110');
            heartIcon.classList.add('fill-current');
            countSpan.innerText = currentCount + 1;
        } else {
            btn.classList.remove('bg-red-500', 'scale-110');
            btn.classList.add('bg-black/30', 'hover:bg-white/20');
            heartIcon.classList.remove('fill-current');
            countSpan.innerText = Math.max(0, currentCount - 1);
        }

        await db.toggleLike(wallpaperId, state.currentUser.id);
        if (window.lucide) lucide.createIcons();
    } catch (e) {
        console.error(e);
        showToast('Action failed', 'error');
        renderCommunity(state.activeCommunityFilter || 'all');
    }
};

window.filterByCreator = function (userId, username) {
    state.activeCommunityFilter = 'creator';
    showToast(`Viewing wallpapers by ${username}`, 'info');
    renderCommunity('all', '', false, userId);
};

window.handleToggleFollow = async function (followingId, followingName) {
    if (!state.currentUser) {
        showToast('Sign in to follow creators!', 'info');
        toggleAuthModal();
        return;
    }

    try {
        const { following } = await db.toggleFollow(state.currentUser.id, followingId);
        showToast(following ? `Following ${followingName}` : `Unfollowed ${followingName}`, 'success');

        // Implementation of Phase 10: Optimistic switch or refresh
        if (state.communitySource === 'following') {
            renderCommunity();
        }
    } catch (e) {
        showToast(e.message || 'Follow action failed', 'error');
    }
};

// Infinite Scroll Observer
const communityObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && state.activeView === 'community' && !state.isLoadingCommunity && state.hasMoreCommunity) {
        renderCommunity(state.activeCommunityFilter, document.getElementById('community-search')?.value || '', true);
    }
}, { threshold: 0.1 });

// Initialize Observer on Sentinel
setTimeout(() => {
    const sentinel = document.getElementById('community-sentinel');
    if (sentinel) communityObserver.observe(sentinel);
}, 2000);

async function syncLocalToCloud() {
    if (!state.currentUser) return;

    const localHistory = JSON.parse(localStorage.getItem('wallpaper_history') || '[]');
    if (localHistory.length === 0) return;

    // Filter out items already synced in this session to avoid spamming
    const toSync = localHistory.filter(item => !item.synced);
    if (toSync.length === 0) return;

    showToast('Syncing local history to cloud...', 'info', 2000);

    let syncCount = 0;
    for (const item of toSync) {
        try {
            // We'll rely on saveWallpaperToDB or a check here
            // For now, simple check by URL
            const { data } = await supabase.from('wallpapers').select('id').eq('url', item.url).maybeSingle();

            if (!data) {
                await db.saveWallpaperToDB({
                    user_id: state.currentUser.id,
                    url: item.url,
                    prompt: item.prompt || 'Restored from local history',
                    genre: item.genre,
                    style: item.style,
                    seed: item.seed,
                    is_public: false
                });
                syncCount++;
            }
            item.synced = true;
        } catch (e) {
            console.error('Failed to sync item:', e);
        }
    }

    if (syncCount > 0) {
        localStorage.setItem('wallpaper_history', JSON.stringify(localHistory));
        showToast(`Synced ${syncCount} new items!`, 'success');
    }
}

// ============================================================================
// SETTINGS & UTILITIES
// ============================================================================

window.toggleSettingsModal = function () {
    const modal = document.getElementById('settings-modal');
    modal.classList.toggle('hidden');

    // Sync current state to inputs
    if (!modal.classList.contains('hidden')) {
        document.getElementById('steps-range').value = state.numSteps || 4;
        document.getElementById('steps-val').innerText = state.numSteps || 4;
        document.getElementById('seed-input-advanced').value = state.seed || '';
    }
};

window.saveSettings = function () {
    state.numSteps = parseInt(document.getElementById('steps-range').value);
    const seedVal = document.getElementById('seed-input-advanced').value;
    state.seed = seedVal ? parseInt(seedVal) : null;

    savePreferences();
    showToast('Settings saved!', 'success');
    toggleSettingsModal();
};

window.clearLocalHistory = function () {
    if (confirm('Are you sure you want to clear your local history and favorites? This will NOT affect cloud-synced items.')) {
        localStorage.removeItem('wallpaper_history');
        localStorage.removeItem('wallpaper_favorites');
        renderHistory();
        renderFavorites();
        showToast('Local history cleared', 'info');
        toggleSettingsModal();
    }
};

// ============================================================================
// COMMUNITY SEARCH & FILTER
// ============================================================================

window.filterCommunity = function (type) {
    // Update UI active state
    document.querySelectorAll('.community-controls button, #community-view button').forEach(b => {
        b.classList.remove('active-filter', 'bg-white/10', 'border-white/20');
        b.classList.add('bg-white/5', 'border-white/10');
    });

    const btn = document.getElementById(`filter-${type}`);
    if (btn) {
        btn.classList.add('active-filter', 'bg-white/10', 'border-white/20');
        btn.classList.remove('bg-white/5', 'border-white/10');
    }

    // Render with filter
    renderCommunity(type);
};

// Add listener for community search
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('community-search')?.addEventListener('input', debounce((e) => {
        renderCommunity('all', e.target.value);
    }, 500));
});

function debounce(func, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

window.togglePublic = async function () {
    if (!state.currentUser) {
        showToast('Please sign in to share wallpapers', 'warning');
        toggleAuthModal();
        return;
    }

    if (!window.currentGeneratedImage) return;

    try {
        // Find existing record or save new one as public
        const { data: existing, error: fetchError } = await supabaseClient
            .from('wallpapers')
            .select('id, is_public')
            .eq('url', window.currentGeneratedImage)
            .maybeSingle();

        if (fetchError) throw fetchError;

        let isPublic = true;

        if (existing) {
            isPublic = !existing.is_public;
            await db.togglePublicStatus(existing.id, isPublic);
        } else {
            showToast('Saving to cloud first...', 'info');
            // This case shouldn't happen often as we save on generate, 
            // but for older/unsynced local ones:
            const wallpaper = await db.saveWallpaperToDB({
                user_id: state.currentUser.id,
                url: window.currentGeneratedImage,
                prompt: document.getElementById('custom-prompt').value || 'Remixed Wallpaper',
                is_public: true
            });
            isPublic = true;
        }

        const btn = document.getElementById('public-toggle-btn');
        if (isPublic) {
            btn.classList.add('bg-green-500', 'text-black', 'border-transparent');
            btn.classList.remove('bg-white/10', 'text-white', 'border-white/10');
            btn.querySelector('span').textContent = 'Public';
            showToast('Wallpaper is now public!', 'success');
        } else {
            btn.classList.remove('bg-green-500', 'text-black', 'border-transparent');
            btn.classList.add('bg-white/10', 'text-white', 'border-white/10');
            btn.querySelector('span').textContent = 'Make Public';
            showToast('Wallpaper is now private', 'info');
        }
    } catch (e) {
        console.error(e);
        showToast('Failed to update status', 'error');
    }
};

window.remixImage = function (id, fromCommunity = false) {
    showToast('Remixing style settings...', 'info');
    document.getElementById('community-view').classList.add('hidden');
    switchView('create');

    // In a full implementation, we'd fetch the wallpaper by ID and 
    // set the prompt/genre/style state. For now, we randomize the existing.
    randomize();
};

window.remixCurrent = function () {
    document.getElementById('result-modal').classList.add('hidden');
    randomize();
};

window.updateProfile = async function () {
    const username = document.getElementById('profile-username').value;
    const avatarUrl = document.getElementById('profile-avatar-url').value;
    if (!username) return;

    try {
        // 1. Update Database Profile Table
        const { error } = await supabaseClient
            .from('profiles')
            .update({
                username: username,
                avatar_url: avatarUrl
            })
            .eq('id', state.currentUser.id);

        if (error) throw error;

        // 2. Sync with Auth Metadata (Crucial for persistence across refreshes)
        await auth.updateUserMetadata({
            username: username,
            avatar_url: avatarUrl
        });

        showToast('Profile updated!', 'success');

        // Update local UI
        const userBtn = document.getElementById('user-btn');
        if (userBtn) {
            const finalAvatar = avatarUrl || `https://ui-avatars.com/api/?name=${username}&background=random`;
            userBtn.innerHTML = `<img src="${finalAvatar}" class="w-full h-full rounded-full">`;
        }

        const profileImg = document.getElementById('profile-avatar');
        if (profileImg) {
            profileImg.src = avatarUrl || `https://ui-avatars.com/api/?name=${username}&background=random`;
        }
    } catch (e) {
        console.error(e);
        showToast('Failed to update profile', 'error');
    }
};

// Update handleUserLogin to populate profile form
const originalHandleUserLogin = window.handleUserLogin;
window.handleUserLogin = async function (user) {
    if (originalHandleUserLogin) originalHandleUserLogin(user);

    // Populate Profile Form
    const emailEl = document.getElementById('profile-email');
    if (emailEl) emailEl.textContent = user.email;

    // Fetch profile data
    const { data } = await supabaseClient
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', user.id)
        .maybeSingle();

    if (data) {
        const usernameEl = document.getElementById('profile-username');
        if (usernameEl) usernameEl.value = data.username || '';

        const avatarUrlEl = document.getElementById('profile-avatar-url');
        if (avatarUrlEl) avatarUrlEl.value = data.avatar_url || '';

        const avatarEl = document.getElementById('profile-avatar');
        if (avatarEl) {
            avatarEl.src = data.avatar_url || `https://ui-avatars.com/api/?name=${data.username || user.email}&background=random`;
        }
    }

    // Switch to profile view in modal if it's open
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const profileForm = document.getElementById('profile-form');

    if (profileForm && !document.getElementById('auth-modal').classList.contains('hidden')) {
        if (loginForm) loginForm.classList.add('hidden');
        if (signupForm) signupForm.classList.add('hidden');
        profileForm.classList.remove('hidden');
    }

    // Override the user button click to show profile instead of just logout
    const userBtn = document.getElementById('user-btn');
    if (userBtn) {
        userBtn.onclick = () => {
            toggleAuthModal();
            if (loginForm) loginForm.classList.add('hidden');
            if (signupForm) signupForm.classList.add('hidden');
            if (profileForm) profileForm.classList.remove('hidden');
        };
    }
};

// Global Export
window.publishHistoryItem = async function (timestamp) {
    if (!state.currentUser) {
        showToast('Please sign in to post to community', 'warning');
        toggleAuthModal();
        return;
    }

    const history = JSON.parse(localStorage.getItem('wallpaper_history') || '[]');
    const item = history.find(i => i.timestamp === Number(timestamp));
    if (!item) return;

    try {
        showToast('Publishing to community...', 'info');

        // Check if exists
        const { data: existing } = await supabaseClient
            .from('wallpapers')
            .select('id, is_public')
            .eq('url', item.url)
            .maybeSingle();

        if (existing) {
            if (existing.is_public) {
                showToast('Already public!', 'info');
            } else {
                await db.togglePublicStatus(existing.id, true);
                showToast('Published to community!', 'success');
            }
        } else {
            // Upload new
            await db.saveWallpaperToDB({
                user_id: state.currentUser.id,
                url: item.url,
                prompt: item.prompt || 'Community Upload',
                genre: item.genre,
                style: item.style,
                seed: item.seed,
                is_public: true
            });
            showToast('Published to community!', 'success');
        }
    } catch (e) {
        console.error(e);
        showToast('Failed to publish', 'error');
    }
};

window.renderCommunity = renderCommunity;
window.syncLocalToCloud = syncLocalToCloud;
