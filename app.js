// Wallpaper Studio Pro - Main Application
import { GENRES, STYLES, PROMPT_TEMPLATES, API_CONFIG, APP_CONFIG } from './config.js';

// ============================================================================
// STATE MANAGEMENT
// ============================================================================
const state = {
    activeGenreIndex: 0,
    activeStyleIndex: 0,
    selectedColorBias: null,
    isDesktopMode: false,
    customColor: null,
    favorites: JSON.parse(localStorage.getItem('wallpaper_favorites') || '[]'),
    advancedMode: false,
    seed: null,
    numSteps: 4,
    isPromptManuallyEdited: false // Flag to track manual edits
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function isMobileDevice() {
    return window.innerWidth < 768;
}

function showToast(message, type = 'info', duration = 3000) {
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const iconMap = {
        success: 'check-circle',
        error: 'alert-circle',
        info: 'info',
        warning: 'alert-triangle'
    };

    toast.innerHTML = `
        <i data-lucide="${iconMap[type]}" class="w-5 h-5"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(toast);
    lucide.createIcons();

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
    lucide.createIcons();
    initCarousel();
    initWebGL();
    initKeyboardNavigation();
    renderHistory();
    renderFavorites();
    updateTime();

    document.getElementById('generate-button').addEventListener('click', handleGenerate);

    // Track manual prompt editing
    document.getElementById('custom-prompt').addEventListener('input', () => {
        state.isPromptManuallyEdited = true;
    });

    loadPreferences();
};

function loadPreferences() {
    const saved = localStorage.getItem('wallpaper_preferences');
    if (saved) {
        const prefs = JSON.parse(saved);
        state.activeGenreIndex = prefs.genreIndex || 0;
        state.activeStyleIndex = prefs.styleIndex || 0;
        updateCarouselUI();
    }
}

function savePreferences() {
    localStorage.setItem('wallpaper_preferences', JSON.stringify({
        genreIndex: state.activeGenreIndex,
        styleIndex: state.activeStyleIndex
    }));
}

// ============================================================================
// CAROUSEL LOGIC
// ============================================================================
function initCarousel() {
    const genreTrack = document.getElementById('genre-track');
    const styleTrack = document.getElementById('style-track');

    GENRES.forEach(g => {
        const el = document.createElement('div');
        el.className = 'carousel-item';
        el.style.backgroundImage = `url('${g.image}')`;
        el.innerHTML = `<div class="w-full h-full carousel-overlay"></div>`;
        genreTrack.appendChild(el);
    });

    STYLES.forEach(s => {
        const el = document.createElement('div');
        el.className = 'carousel-item';
        el.style.backgroundImage = `url('${s.image}')`;
        el.innerHTML = `<div class="w-full h-full carousel-overlay"></div>`;
        styleTrack.appendChild(el);
    });

    updateCarouselUI();
}

function updateCarouselUI() {
    document.getElementById('genre-track').style.transform = `translateX(-${state.activeGenreIndex * 100}%)`;
    document.getElementById('style-track').style.transform = `translateX(-${state.activeStyleIndex * 100}%)`;
    document.getElementById('genre-label').innerText = GENRES[state.activeGenreIndex].name;
    document.getElementById('style-label').innerText = STYLES[state.activeStyleIndex].name;
    
    updateCustomPromptPlaceholder();
    savePreferences();
}

// ============================================================================
// PROMPT PROTECTION LOGIC
// ============================================================================
function checkPromptConflict() {
    if (state.isPromptManuallyEdited) {
        const choice = confirm(
            "You have a custom prompt active.\n\n" +
            "Click OK to DISCARD it and switch styles.\n" +
            "Click CANCEL to keep your prompt."
        );

        if (choice) {
            // User chose to discard/overwrite.
            // AUTO-COPY Feature: Save old prompt to clipboard before destroying it
            const oldPrompt = document.getElementById('custom-prompt').value;
            navigator.clipboard.writeText(oldPrompt).then(() => {
                showToast("Old prompt copied to clipboard", "info");
            }).catch(() => {});

            state.isPromptManuallyEdited = false;
            document.getElementById('custom-prompt').value = ''; 
            return true; // Allow change
        }
        return false; // Block change
    }
    return true; // No conflict
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
    document.getElementById('custom-prompt').value = '';
    
    if (!document.getElementById('generation-overlay').classList.contains('hidden')) {
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
// KEYBOARD NAVIGATION
// ============================================================================
function initKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

        const isGenerationOverlayOpen = !document.getElementById('generation-overlay').classList.contains('hidden');

        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                prevSlide('genre');
                break;
            case 'ArrowRight':
                e.preventDefault();
                nextSlide('genre');
                break;
            case 'ArrowUp':
                e.preventDefault();
                prevSlide('style');
                break;
            case 'ArrowDown':
                e.preventDefault();
                nextSlide('style');
                break;
            case 'Enter':
                if (!document.getElementById('result-modal').classList.contains('hidden')) return;
                e.preventDefault();
                handleGenerate();
                break;
            case 'r':
            case 'R':
                if (e.ctrlKey || e.metaKey) return;
                e.preventDefault();
                randomize();
                break;
            case 'h':
            case 'H':
                if (e.ctrlKey || e.metaKey) return;
                e.preventDefault();
                toggleHistory();
                break;
            case 'v':
            case 'V':
                if (isGenerationOverlayOpen) {
                    e.preventDefault();
                    viewFullResult();
                }
                break;
            case 'd':
            case 'D':
                if (isGenerationOverlayOpen) {
                    e.preventDefault();
                    downloadGenerated();
                }
                break;
            case 'x':
            case 'X':
            case 'Escape':
                e.preventDefault();
                if (isGenerationOverlayOpen) {
                    closeGenerationDisplay();
                } else {
                    closeResult();
                    if (!document.getElementById('history-drawer').classList.contains('translate-x-full')) {
                        toggleHistory();
                    }
                }
                break;
        }
    });
}

// ============================================================================
// PROMPT EDITOR
// ============================================================================
function togglePromptEditor() {
    const area = document.getElementById('custom-prompt');
    area.classList.toggle('hidden');
    
    if (!area.classList.contains('hidden')) {
        updateCustomPromptPlaceholder();
        area.focus();
    }
}

function updateCustomPromptPlaceholder() {
    const genre = GENRES[state.activeGenreIndex].prompt;
    const style = STYLES[state.activeStyleIndex].prompt;
    const color = state.selectedColorBias ? `, ${state.selectedColorBias} color palette` : '';
    const customColorText = state.customColor ? `, ${state.customColor} tones` : '';
    const text = `${genre}, ${style}${color}${customColorText}. 8k resolution, highly detailed.`;

    const area = document.getElementById('custom-prompt');
    
    area.placeholder = text;

    if (!state.isPromptManuallyEdited) {
        area.value = text;
    }
}

function copyPrompt() {
    const area = document.getElementById('custom-prompt');
    const prompt = area.value || area.placeholder;
    copyToClipboard(prompt);
}

// ============================================================================
// ASPECT RATIO TOGGLE
// ============================================================================
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
    lucide.createIcons();
}

// ============================================================================
// COLOR BIAS
// ============================================================================
function setColorBias(color) {
    state.selectedColorBias = color;
    document.querySelectorAll('.color-dot').forEach(dot => dot.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    updateCustomPromptPlaceholder();
}

function setCustomColor() {
    const picker = document.getElementById('custom-color-picker');
    state.customColor = picker.value;
    showToast(`Custom color: ${picker.value}`, 'info', 2000);
    updateCustomPromptPlaceholder();
}

// ============================================================================
// ADVANCED CONTROLS
// ============================================================================
function toggleAdvancedControls() {
    state.advancedMode = !state.advancedMode;
    const panel = document.getElementById('advanced-controls');
    panel.classList.toggle('expanded');

    const btn = event.currentTarget;
    const icon = btn.querySelector('i');
    icon.setAttribute('data-lucide', state.advancedMode ? 'chevron-up' : 'chevron-down');
    lucide.createIcons();
}

function updateSeed(value) {
    state.seed = value ? parseInt(value) : null;
}

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
// HISTORY MANAGEMENT
// ============================================================================
function toggleHistory() {
    const drawer = document.getElementById('history-drawer');
    const overlay = document.getElementById('history-overlay');
    if (drawer.classList.contains('translate-x-full')) {
        drawer.classList.remove('translate-x-full');
        overlay.classList.remove('hidden');
    } else {
        drawer.classList.add('translate-x-full');
        overlay.classList.add('hidden');
    }
}

function saveToHistory(url, genreName, styleName, prompt, seed) {
    const history = JSON.parse(localStorage.getItem('wallpaper_history') || '[]');
    const newItem = {
        url,
        genre: genreName,
        style: styleName,
        prompt,
        seed,
        date: new Date().toLocaleString(),
        timestamp: Date.now()
    };
    history.unshift(newItem);
    if (history.length > APP_CONFIG.MAX_HISTORY_ITEMS) history.pop();
    localStorage.setItem('wallpaper_history', JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    const history = JSON.parse(localStorage.getItem('wallpaper_history') || '[]');
    const list = document.getElementById('history-list');
    list.innerHTML = '';

    if (history.length === 0) {
        list.innerHTML = '<p class="text-gray-500 text-center mt-10">No wallpapers yet.</p>';
        return;
    }

    history.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'history-item bg-white/5 p-2 rounded-lg flex gap-3 items-center hover:bg-white/10 transition';
        div.innerHTML = `
            <img src="${item.url}" class="w-12 h-12 rounded object-cover bg-black" loading="lazy" alt="Wallpaper thumbnail" />
            <div class="flex-1 min-w-0">
                <p class="text-sm font-bold text-white truncate">${item.genre} + ${item.style}</p>
                <p class="text-xs text-gray-400">${item.date}</p>
            </div>
            <button onclick="toggleFavorite('${item.url}')" class="favorite-star ${state.favorites.includes(item.url) ? 'active' : ''}" title="Add to favorites">
                <i data-lucide="star" class="w-4 h-4"></i>
            </button>
            <button onclick="deleteHistoryItem(${index})" class="p-1 hover:bg-red-500/20 rounded" title="Delete">
                <i data-lucide="trash-2" class="w-4 h-4 text-red-400"></i>
            </button>
            <button onclick="showResult('${item.url}', ${item.seed || 'null'})" class="p-1 hover:bg-white/20 rounded" title="View">
                <i data-lucide="eye" class="w-4 h-4"></i>
            </button>
        `;
        list.appendChild(div);
    });

    lucide.createIcons();
}

function deleteHistoryItem(index) {
    const history = JSON.parse(localStorage.getItem('wallpaper_history') || '[]');
    history.splice(index, 1);
    localStorage.setItem('wallpaper_history', JSON.stringify(history));
    renderHistory();
    showToast('Deleted from history', 'success', 2000);
}

function clearHistory() {
    if (confirm('Clear all history? This cannot be undone.')) {
        localStorage.setItem('wallpaper_history', '[]');
        renderHistory();
        showToast('History cleared', 'success');
    }
}

// ============================================================================
// FAVORITES MANAGEMENT
// ============================================================================
function toggleFavorite(url) {
    const index = state.favorites.indexOf(url);
    if (index > -1) {
        state.favorites.splice(index, 1);
        showToast('Removed from favorites', 'info', 2000);
    } else {
        state.favorites.push(url);
        showToast('Added to favorites', 'success', 2000);
    }
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

// ============================================================================
// LOCK SCREEN PREVIEW
// ============================================================================
function toggleLockScreen() {
    const overlay = document.getElementById('lock-screen-overlay');
    overlay.classList.toggle('hidden');
}

function updateTime() {
    const now = new Date();
    const timeEl = document.getElementById('lock-time');
    const dateEl = document.getElementById('lock-date');

    if (timeEl) {
        timeEl.innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (dateEl) {
        dateEl.innerText = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    }

    setTimeout(updateTime, 1000);
}

// ============================================================================
// API & GENERATION
// ============================================================================
async function handleGenerate() {
    const genre = GENRES[state.activeGenreIndex];
    const style = STYLES[state.activeStyleIndex];
    
    const promptInput = document.getElementById('custom-prompt');
    let finalPrompt = promptInput.value;

    if (!finalPrompt || finalPrompt.trim() === '') {
        const color = state.selectedColorBias ? `, ${state.selectedColorBias} color palette` : '';
        const customColorText = state.customColor ? `, ${state.customColor} tones` : '';
        finalPrompt = `${genre.prompt}, ${style.prompt}${color}${customColorText}. ${state.isDesktopMode ? 'Desktop' : 'Mobile'} wallpaper, 8k resolution, highly detailed, aesthetic.`;
    }

    const w = parseInt(document.getElementById('width').value);
    const h = parseInt(document.getElementById('height').value);
    const seed = state.seed || Math.floor(Math.random() * 1000000);

    const overlay = document.getElementById('generation-overlay');
    const canvas = document.getElementById('webgl-generation-canvas');
    const statusDiv = document.getElementById('generation-status');
    const resultImage = document.getElementById('generation-result-image');
    const actions = document.getElementById('generation-actions');

    overlay.classList.remove('hidden');
    canvas.classList.remove('hidden');
    statusDiv.classList.remove('hidden');
    resultImage.classList.add('hidden');
    actions.classList.add('hidden');

    // *** FIX: Reset Opacity explicitly here ***
    // This ensures animation is visible even if triggering consecutively
    canvas.style.opacity = '1';
    statusDiv.style.opacity = '1';

    document.getElementById('loading-text').innerText = `Creating ${state.isDesktopMode ? 'Desktop' : 'Mobile'} Wallpaper`;

    initGenerationAnimation();

    try {
        let data = null;
        for (let i = 0; i < API_CONFIG.MAX_RETRIES; i++) {
            try {
                const response = await fetch(API_CONFIG.BASE_URL + API_CONFIG.GENERATION_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        prompt: finalPrompt,
                        width: w,
                        height: h,
                        num_steps: state.numSteps,
                        seed: seed
                    })
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                data = await response.json();
                break;
            } catch (e) {
                if (i === API_CONFIG.MAX_RETRIES - 1) throw e;
                await new Promise(r => setTimeout(r, API_CONFIG.RETRY_DELAY));
            }
        }

        if (data && data.output) {
            stopGenerationAnimation();

            const canvas = document.getElementById('webgl-generation-canvas');
            const statusDiv = document.getElementById('generation-status');
            const resultImage = document.getElementById('generation-result-image');
            const actions = document.getElementById('generation-actions');

            canvas.style.transition = 'opacity 0.5s ease';
            statusDiv.style.transition = 'opacity 0.5s ease';
            canvas.style.opacity = '0';
            statusDiv.style.opacity = '0';

            setTimeout(() => {
                canvas.classList.add('hidden');
                statusDiv.classList.add('hidden');

                resultImage.src = data.output;
                resultImage.classList.remove('hidden');
                resultImage.style.opacity = '0';
                resultImage.style.transition = 'opacity 0.5s ease';

                setTimeout(() => {
                    resultImage.style.opacity = '1';
                    actions.classList.remove('hidden');
                    lucide.createIcons();
                }, 50);
            }, 500);

            window.currentGeneratedImage = data.output;
            window.currentGeneratedSeed = seed;

            saveToHistory(data.output, genre.name, style.name, finalPrompt, seed);
            showToast('Wallpaper created successfully!', 'success');
        } else {
            throw new Error('No output');
        }

    } catch (error) {
        console.error(error);
        stopGenerationAnimation();
        closeGenerationDisplay();
        showToast('Generation failed. Please try again.', 'error');
    }
}

async function handleBatchGenerate() {
    const count = parseInt(document.getElementById('batch-count').value) || 4;
    showToast(`Generating ${count} variations...`, 'info', 3000);
}

function showResult(url, seed = null) {
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

    document.getElementById('lock-screen-overlay').classList.add('hidden');
    modal.classList.remove('hidden');
}

function closeResult() {
    document.getElementById('result-modal').classList.add('hidden');
}

// ============================================================================
// WEBGL BACKGROUND
// ============================================================================
function initWebGL() {
    const canvas = document.getElementById('webgl-canvas');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.position.z = 5;

    const particleCount = isMobileDevice() ? APP_CONFIG.WEBGL_PARTICLE_COUNT_MOBILE : APP_CONFIG.WEBGL_PARTICLE_COUNT;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i++) {
        positions[i] = (Math.random() - 0.5) * 20;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
        color: 0x444444,
        size: 0.05,
        transparent: true,
        opacity: 0.6
    });
    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    function animate() {
        requestAnimationFrame(animate);
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
}

// ============================================================================
// SHARE FUNCTIONALITY
// ============================================================================

function toggleShareMenu() {
    const menu = document.getElementById('share-menu');
    const nativeBtn = document.getElementById('native-share-btn');
    const nativeDivider = document.getElementById('native-share-divider');

    if (nativeBtn && nativeDivider) {
        if (navigator.share) {
            nativeBtn.classList.remove('hidden');
            nativeDivider.classList.remove('hidden');
        } else {
            nativeBtn.classList.add('hidden');
            nativeDivider.classList.add('hidden');
        }
    }

    menu.classList.toggle('active');
}

async function shareImage(platform) {
    const url = document.getElementById('result-image').src;

    if (!url) {
        showToast('No image to share.', 'error');
        toggleShareMenu(); 
        return;
    }

    const shareOptions = {
        title: 'Wallpaper Studio Pro',
        text: 'Check out this awesome AI-generated wallpaper I made with Wallpaper Studio Pro! #NothingCommunity',
        url: url 
    };

    switch (platform) {
        case 'native':
            if (navigator.share) {
                try {
                    await navigator.share(shareOptions);
                } catch (error) {
                    if (error.name !== 'AbortError') {
                        showToast('Share failed.', 'error');
                    }
                }
            }
            break;

        case 'download':
            await downloadImageDirect(url);
            break;

        case 'copy':
            copyToClipboard(url);
            showToast('Image link copied to clipboard!', 'success');
            break;

        case 'twitter':
            const twitterText = encodeURIComponent(shareOptions.text + ' ' + shareOptions.url);
            window.open(`https://twitter.com/intent/tweet?text=${twitterText}`, '_blank');
            break;

        case 'facebook':
            window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareOptions.url)}`, '_blank');
            break;
    }

    if (platform !== 'native') {
        toggleShareMenu();
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
    } catch (error) {
        console.error('Download failed:', error);
        showToast('Download failed', 'error');
    }
}
// ============================================================================
// WEBGL GENERATION ANIMATION
// ============================================================================
let generationScene = null;
let generationCamera = null;
let generationRenderer = null;
let generationAnimationId = null;

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
    const sizes = new Float32Array(pixelCount);
    const velocities = new Float32Array(pixelCount * 3);
    const targetPositions = new Float32Array(pixelCount * 3);

    for (let i = 0; i < pixelCount; i++) {
        const i3 = i * 3;

        const radius = 40 + Math.random() * 20;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;

        positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i3 + 2] = -radius; 

        const gridSize = Math.ceil(Math.sqrt(pixelCount));
        const x = (i % gridSize) - gridSize / 2;
        const y = Math.floor(i / gridSize) - gridSize / 2;

        targetPositions[i3] = x * 0.08; 
        targetPositions[i3 + 1] = y * 0.08;
        targetPositions[i3 + 2] = 0;

        velocities[i3] = (Math.random() - 0.5) * 0.05;
        velocities[i3 + 1] = (Math.random() - 0.5) * 0.05;
        velocities[i3 + 2] = (Math.random() - 0.5) * 0.05;

        sizes[i] = 0.12;
    }

    pixelGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    pixelGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const pixelMaterial = new THREE.PointsMaterial({
        size: 0.12,
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
    });

    const pixelSystem = new THREE.Points(pixelGeometry, pixelMaterial);
    generationScene.add(pixelSystem);

    const centerGeometry = new THREE.SphereGeometry(0.3, 32, 32);
    const centerMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.2
    });
    const centerSphere = new THREE.Mesh(centerGeometry, centerMaterial);
    generationScene.add(centerSphere);

    const ambientLight = new THREE.AmbientLight(0x606060);
    generationScene.add(ambientLight);

    let startTime = Date.now();

    function animate() {
        generationAnimationId = requestAnimationFrame(animate);

        const elapsed = (Date.now() - startTime) * 0.001;
        const positions = pixelGeometry.attributes.position.array;

        for (let i = 0; i < pixelCount; i++) {
            const i3 = i * 3;

            positions[i3] += velocities[i3] * 2;
            positions[i3 + 1] += velocities[i3 + 1] * 2;
            positions[i3 + 2] += 0.15; 

            positions[i3] += Math.sin(elapsed * 0.5 + i * 0.1) * 0.02;
            positions[i3 + 1] += Math.cos(elapsed * 0.5 + i * 0.1) * 0.02;

            if (positions[i3 + 2] > 5) {
                positions[i3 + 2] = -50 - Math.random() * 10;
                positions[i3] = (Math.random() - 0.5) * 20;
                positions[i3 + 1] = (Math.random() - 0.5) * 20;
            }

            const depth = positions[i3 + 2];
            const normalizedDepth = Math.max(0, Math.min(1, (-depth + 5) / 50));
            const baseSize = 0.05;
            const blurSize = 0.35;
            pixelGeometry.attributes.size.array[i] = baseSize + normalizedDepth * blurSize;
        }

        pixelGeometry.attributes.position.needsUpdate = true;
        pixelGeometry.attributes.size.needsUpdate = true;

        pixelSystem.rotation.y = elapsed * 0.03;

        const pulse = 1 + Math.sin(elapsed * 3) * 0.25;
        centerSphere.scale.set(pulse, pulse, pulse);
        centerSphere.material.opacity = 0.15 + Math.sin(elapsed * 3) * 0.08;

        generationRenderer.render(generationScene, generationCamera);
    }

    animate();
}

function stopGenerationAnimation() {
    if (generationAnimationId) {
        cancelAnimationFrame(generationAnimationId);
        generationAnimationId = null;
    }
    if (generationRenderer) {
        generationRenderer.dispose();
        generationRenderer = null;
    }
    generationScene = null;
    generationCamera = null;
}

function closeGenerationDisplay() {
    stopGenerationAnimation();
    const overlay = document.getElementById('generation-overlay');
    overlay.classList.add('hidden');

    const canvas = document.getElementById('webgl-generation-canvas');
    const statusDiv = document.getElementById('generation-status');
    const resultImage = document.getElementById('generation-result-image');
    
    canvas.style.opacity = '1';
    statusDiv.style.opacity = '1';
    resultImage.src = '';
}

function viewFullResult() {
    if (window.currentGeneratedImage) {
        showResult(window.currentGeneratedImage, window.currentGeneratedSeed);
        closeGenerationDisplay();
    }
}

async function downloadGenerated() {
    if (window.currentGeneratedImage) {
        await downloadImageDirect(window.currentGeneratedImage);
    }
}

// ============================================================================
// EXPORT FUNCTIONS TO WINDOW (for inline onclick handlers)
// ============================================================================
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
window.downloadFromModal = async function () {
    const url = document.getElementById('result-image').src;
    if (url) {
        await downloadImageDirect(url);
    }
};

// ============================================================================
// INITIALIZATION
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    if (document.readyState === 'complete') return;
    initCarousel();
    initWebGL();
    renderHistory();
    updateCustomPromptPlaceholder();
    initKeyboardNavigation();
    lucide.createIcons();
});
