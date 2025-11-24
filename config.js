// --- START OF FILE config.js ---

export const GENRES = [
    {
        id: 'cyberpunk',
        name: 'Cyber City',
        prompt: 'futuristic cyberpunk metropolis, towering skyscrapers with neon advertisements, rain-slicked streets reflecting vibrant lights, cinematic sci-fi concept art',
        image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&q=80',
        color: 0xcd00ff // Neon Purple
    },
    {
        id: 'nature',
        name: 'Deep Nature',
        prompt: 'majestic mountain landscape photography, dense emerald pine forests, warm golden hour sunlight piercing through mist, wide-angle shot, national geographic style',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
        color: 0x228b22 // Forest Green
    },
    {
        id: 'space',
        name: 'Cosmos',
        prompt: 'deep space cosmos, vibrant nebula clouds in blue and purple, distant glowing star fields, galactic dust, 8k digital space art, ethereal and vast',
        image: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=800&q=80',
        color: 0x000080 // Navy Blue
    },
    {
        id: 'abstract',
        name: 'Abstract',
        prompt: '3D abstract composition, fluid liquid shapes, translucent glass and metal textures, soft studio lighting, raytracing render, modern digital art',
        image: 'https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=800&q=80',
        color: 0xffa500 // Orange
    },
    {
        id: 'cars',
        name: 'Supercars',
        prompt: 'automotive photography of a sleek hypercar, dynamic motion blur on asphalt track, gleaming reflections, dramatic dusk lighting, low angle shot',
        image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80',
        color: 0xdc143c // Crimson Red
    },
    {
        id: 'zen',
        name: 'Zen Garden',
        prompt: 'traditional Japanese zen garden, raked sand patterns, bonsai trees and moss rocks, soft diffused natural light, peaceful architectural photography',
        image: 'https://images.unsplash.com/photo-1528164344705-47542687000d?w=800&q=80',
        color: 0xffb7c5 // Cherry Blossom Pink
    },
    {
        id: 'ocean',
        name: 'Ocean Depths',
        prompt: 'underwater marine photography, vibrant coral reef, shafts of sunlight breaking through water surface, crystal clear turquoise water, detailed aquatic life',
        image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=80',
        color: 0x00ced1 // Dark Turquoise
    },
    {
        id: 'fantasy',
        name: 'Fantasy Realm',
        prompt: 'epic fantasy landscape, floating islands in the sky, magical glowing crystals, waterfalls cascading into clouds, matte painting style',
        image: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800&q=80',
        color: 0x9370db // Medium Purple
    },
    {
        id: 'pastel',
        name: 'Pastel Dreamscape',
        prompt: 'surreal minimalist landscape, rolling hills in soft pastel pink and blue, ethereal diffuse lighting, dreamlike atmosphere, smooth gradients',
        image: 'https://images.unsplash.com/photo-1533038590840-1cde6e668a91?w=800&q=80',
        color: 0xb0e0e6 // Powder Blue
    },
    {
        id: 'cozyinterior',
        name: 'Cozy Interior',
        prompt: 'interior design photography, cozy reading corner, soft knitted blankets, warm string lights, steaming coffee mug, hygge atmosphere, depth of field',
        image: 'https://plus.unsplash.com/premium_photo-1674815329488-c4fc6bf4ced8',
        color: 0xd2691e // Chocolate/Warm Brown
    },
    {
        id: 'lofi',
        name: 'Lo-fi Study Vibes',
        prompt: 'lofi hip hop aesthetic, anime-style bedroom at night, rain on window, purple and blue ambient lighting, cluttered desk, nostalgic mood',
        image: 'https://images.unsplash.com/photo-1534067783941-51c9c23ecefd?w=800&q=80',
        color: 0x483d8b // Dark Slate Blue
    },
    {
        id: 'goldenhour',
        name: 'Golden Hour City',
        prompt: 'urban cityscape photography at sunset, rich warm golden sunlight reflecting off windows, cinematic lens flares, atmospheric perspective',
        image: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80',
        color: 0xff8c00 // Dark Orange
    },
    {
        id: 'sky',
        name: 'Sky & Clouds',
        prompt: 'majestic cloudscape, cumulus clouds illuminated by vibrant sunrise, expansive celestial atmosphere, dreamy aerial photography',
        image: 'https://images.unsplash.com/photo-1501630834273-4b5604d2ee31?w=800&q=80',
        color: 0x87ceeb // Sky Blue
    },
    {
        id: 'terrain',
        name: 'Rough Terrain',
        prompt: 'rugged geological landscape, rocky canyons and cliffs, raw textured stone, desert badlands, earth tones, aerial drone shot',
        image: 'https://images.unsplash.com/photo-1546514355-7fdc90ccbd03?w=800&q=80',
        color: 0xa0522d // Sienna
    },
    {
        id: 'stilllife',
        name: 'Still Life',
        prompt: 'classic fine art still life, arranged fruits and brass objects, dramatic chiaroscuro side lighting, rich shadows, renaissance style',
        image: 'https://images.unsplash.com/photo-1588263823647-ce3546d42bfe?w=800&q=80',
        color: 0x8b4513 // Saddle Brown
    },
    {
        id: 'iridescence',
        name: 'Iridescence',
        prompt: 'holographic iridescent background, shimmering pearl colors, liquid metal reflections, chromatic aberration, prismatic light diffraction',
        image: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=800&q=80',
        color: 0x00ffff // Cyan
    },
    {
        id: 'flora',
        name: 'Lush Flora',
        prompt: 'macro botanical photography, intricate leaf veins and dew drops, vibrant blooming exotic flowers, shallow depth of field, lush greenery',
        image: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=800&q=80',
        color: 0x32cd32 // Lime Green
    }
];

export const STYLES = [
    {
        id: 'minimal',
        name: 'Minimalist',
        prompt: 'minimalist graphic design style, flat solid colors, simple geometric shapes, vast negative space, clean vector art',
        image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80'
    },
    {
        id: 'oil',
        name: 'Oil Paint',
        prompt: 'impasto oil painting technique, thick visible brushstrokes, rich textured canvas, vibrant color mixing, classical fine art style',
        image: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&q=80'
    },
    {
        id: 'neon',
        name: 'Neon Glow',
        prompt: 'synthwave neon aesthetic, glowing grid lines, retro 80s computer graphics, laser beams, high contrast black background with saturated neon',
        image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80'
    },
    {
        id: 'sketch',
        name: 'Tech Sketch',
        prompt: 'technical architectural blueprint, fine white chalk lines on dark blue paper, precise measurements, schematic drawing style',
        image: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=800&q=80'
    },
    {
        id: 'clay',
        name: '3D Clay',
        prompt: '3D plasticine clay render, soft rounded edges, matte finish, fingerprint textures, handcrafted stop-motion animation style, cute isometric view',
        image: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=800&q=80'
    },
    {
        id: 'noir',
        name: 'Film Noir',
        prompt: 'classic film noir photography, high contrast black and white, dramatic shadows and silhouettes, moody atmosphere, film grain',
        image: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&q=80'
    },
    {
        id: 'watercolor',
        name: 'Watercolor',
        prompt: 'wet-on-wet watercolor painting, soft bleeding edges, translucent color washes, paper texture, artistic and dreamy',
        image: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&q=80'
    },
    {
        id: 'pixel',
        name: 'Pixel Art',
        prompt: 'retro 16-bit pixel art, nostalgic game aesthetic, crisp low-resolution sprite work, limited color palette, dithering',
        image: 'https://images.unsplash.com/photo-1671750764695-10c7f164844c'
    },
    {
        id: 'anime',
        name: 'Anime Aesthetic',
        prompt: 'high-quality anime key visual, Makoto Shinkai style, vibrant sky, dramatic lighting, detailed linework, cel shaded characters',
        image: 'https://plus.unsplash.com/premium_photo-1661964177687-57387c2cbd14'
    },
    {
        id: 'photoreal',
        name: 'Photorealistic',
        prompt: 'hyper-realistic photography, 8k resolution, extremely detailed, perfect lighting, uncompressed raw image quality, macro details',
        image: 'https://images.unsplash.com/photo-1690626826406-c2fc0d344551'
    },
    {
        id: 'voxel',
        name: 'Voxel Art',
        prompt: 'voxel art style, cubic 3D blocks, crisp isometric perspective, bright playful colors, digital minecraft aesthetic',
        image: 'https://images.unsplash.com/photo-1743306947426-06d3d970e58f'
    },
    {
        id: 'cinematic',
        name: 'Cinematic',
        prompt: 'anamorphic cinematic shot, wide aspect ratio, bold color grading, deep bokeh, dramatic lighting contrast, movie scene quality',
        image: 'https://images.unsplash.com/photo-1610847455028-9e55e62bac33'
    },
    {
        id: 'glitch',
        name: 'Glitch Effect',
        prompt: 'digital datamosh glitch art, RGB color splitting, corrupted video signal, pixel sorting, cyberpunk distortion',
        image: 'https://images.unsplash.com/photo-1634368998864-8984df61cdda'
    },
    {
        id: 'lowpoly',
        name: 'Low Poly',
        prompt: 'low-poly 3D render, faceted geometric meshes, soft pastel gradient lighting, minimalist polygon art, clean edges',
        image: 'https://images.unsplash.com/photo-1643143596361-a39511490214'
    },
    {
        id: 'bwphoto',
        name: 'B&W Photo',
        prompt: 'vintage black and white analog photography, silver gelatin print look, heavy film grain, high contrast monochrome',
        image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80'
    },
    {
        id: 'classicpaint',
        name: 'Classic Painting',
        prompt: 'Renaissance style painting, visible brushstrokes, dramatic composition, acrylic texture, museum quality art',
        image: 'https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?w=800&q=80'
    },
    {
        id: 'graphic',
        name: 'Graphic Design',
        prompt: 'Swiss style graphic design, bold typography, strong grid layout, flat distinct shapes, vector illustration',
        image: 'https://images.unsplash.com/photo-1586974087421-2ba56dab378c'
    },
    {
        id: 'ink',
        name: 'Ink Wash',
        prompt: 'traditional Sumi-e ink wash painting, monochromatic flowing black ink on rice paper, minimalist brush strokes, zen aesthetic',
        image: 'https://images.unsplash.com/photo-1515405295579-ba7b45403062?w=800&q=80'
    },
    {
        id: 'modernist',
        name: 'Modernist',
        prompt: 'Mid-century modernist art, Bauhaus influence, geometric abstraction, primary colors (red, blue, yellow), clean lines',
        image: 'https://images.unsplash.com/photo-1554147090-e1221a04a025?w=800&q=80'
    }
];

export const COLOR_BIASES = [
    { id: null, name: 'None', color: 'bg-gray-600', border: 'border-white/30' },
    { id: 'red', name: 'Red', color: 'bg-red-600', border: '' },
    { id: 'blue', name: 'Blue', color: 'bg-blue-600', border: '' },
    { id: 'gold', name: 'Gold', color: 'bg-yellow-500', border: '' },
    { id: 'black and white', name: 'B&W', color: 'bg-black', border: 'border-white' },
    { id: 'purple', name: 'Purple', color: 'bg-purple-600', border: '' },
    { id: 'green', name: 'Green', color: 'bg-green-600', border: '' },
    { id: 'orange', name: 'Orange', color: 'bg-orange-600', border: '' }
];

export const PROMPT_TEMPLATES = [
    '{genre} rendered in {style} with {color} color palette',
    'A masterpiece of {genre} featuring {style} elements',
    '{style} artwork depicting {genre}',
    'High quality {genre} using {style} technique',
    '{genre} visualized through {style}'
];

export const API_CONFIG = {
    BASE_URL: '',
    GENERATION_ENDPOINT: '/.netlify/functions/generate',
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000
};

export const APP_CONFIG = {
    MAX_HISTORY_ITEMS: 20,
    DEFAULT_WIDTH: 1080,
    DEFAULT_HEIGHT: 1920,
    DESKTOP_WIDTH: 1920,
    DESKTOP_HEIGHT: 1080,
    WEBGL_PARTICLE_COUNT: 600,
    WEBGL_PARTICLE_COUNT_MOBILE: 300
};
