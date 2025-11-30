// --- START OF FILE config.js ---

export const GENRES = [
    {
        id: 'cyberpunk',
        name: 'Cyber City',
        prompt: 'futuristic cyberpunk mega-city featuring a neon-soaked skyline with towering holograms under a rainy night sky exuding high-tech vibes',
        image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&q=80',
        color: 0xcd00ff // Neon Purple
    },
    {
        id: 'nature',
        name: 'Deep Nature',
        prompt: 'majestic mountain vista overlooking dense emerald forests bathed in a warm golden hour glow appearing serene and untamed',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
        color: 0x228b22 // Forest Green
    },
    {
        id: 'space',
        name: 'Cosmos',
        prompt: 'expansive cosmic nebula with radiant star fields and drifting galactic dust shown on an epic cinematic scale',
        image: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=800&q=80',
        color: 0x000080 // Navy Blue
    },
    {
        id: 'abstract',
        name: 'Abstract',
        prompt: '3D abstract geometry featuring fluid organic forms and translucent glass textures in a sleek minimal design',
        image: 'https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=800&q=80',
        color: 0xffa500 // Orange
    },
    {
        id: 'cars',
        name: 'Supercars',
        prompt: 'Supercar moving at high speed captured in a wide angle shot with glossy reflections and dramatic cinematic lighting',
        image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80',
        color: 0xdc143c // Crimson Red
    },
    {
        id: 'zen',
        name: 'Zen Garden',
        prompt: 'serene Japanese zen garden with falling cherry blossoms and tranquil water features illuminated by soft pastel lighting',
        image: 'https://images.unsplash.com/photo-1528164344705-47542687000d?w=800&q=80',
        color: 0xffb7c5 // Cherry Blossom Pink
    },
    {
        id: 'ocean',
        name: 'Ocean Depths',
        prompt: 'vibrant coral reef teeming with colorful tropical marine life in crystal-clear blue water pierced by shimmering sunbeams',
        image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=80',
        color: 0x00ced1 // Dark Turquoise
    },
    {
        id: 'fantasy',
        name: 'Fantasy Realm',
        prompt: 'enchanted fantasy realm featuring floating sky islands and glowing mystical auroras evoking a sense of epic wonder',
        image: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800&q=80',
        color: 0x9370db // Medium Purple
    },
    {
        id: 'pastel',
        name: 'Pastel Dreamscape',
        prompt: 'dreamy minimalist landscape in a soft pastel palette with ethereal diffuse light and serene abstract skies',
        image: 'https://images.unsplash.com/photo-1533038590840-1cde6e668a91?w=800&q=80',
        color: 0xb0e0e6 // Powder Blue
    },
    {
        id: 'cozyinterior',
        name: 'Cozy Interior',
        prompt: 'cozy hygge room with warm sunlit windows and plush soft textures featuring layered pillows in a peaceful still life composition',
        image: 'https://plus.unsplash.com/premium_photo-1674815329488-c4fc6bf4ced8',
        color: 0xd2691e // Chocolate/Warm Brown
    },
    {
        id: 'lofi',
        name: 'Lo-fi Study Vibes',
        prompt: 'study table with cozy lighting while raining outside featuring a warm lamp glow and a steaming mug on a calm chilled night',
        image: 'https://images.unsplash.com/photo-1534067783941-51c9c23ecefd?w=800&q=80',
        color: 0x483d8b // Dark Slate Blue
    },
    {
        id: 'goldenhour',
        name: 'Golden Hour City',
        prompt: 'urban skyline at golden hour bathed in rich warm sunlight with cinematic lens flares over a calm atmospheric cityscape',
        image: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80',
        color: 0xff8c00 // Dark Orange
    },
    {
        id: 'sky',
        name: 'Sky & Clouds',
        prompt: 'majestic rolling clouds during a vibrant sunrise or sunset creating an expansive celestial atmosphere',
        image: 'https://images.unsplash.com/photo-1501630834273-4b5604d2ee31?w=800&q=80',
        color: 0x87ceeb // Sky Blue
    },
    {
        id: 'terrain',
        name: 'Rough Terrain',
        prompt: 'rocky canyon landscapes with rugged cliffs and raw geological textures showing desert badlands in earthy tones',
        image: 'https://images.unsplash.com/photo-1546514355-7fdc90ccbd03?w=800&q=80',
        color: 0xa0522d // Sienna
    },
    {
        id: 'stilllife',
        name: 'Still Life',
        prompt: 'classic still life composition with an arranged flowerpot on a white background with dramatic chiaroscuro lighting and fine art detail',
        image: 'https://images.unsplash.com/photo-1588263823647-ce3546d42bfe?w=800&q=80',
        color: 0x8b4513 // Saddle Brown
    },
    {
        id: 'iridescence',
        name: 'Iridescence',
        prompt: 'holographic iridescent textures with shimmering pearl colors and liquid metal reflections causing prismatic light diffraction',
        image: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=800&q=80',
        color: 0x00ffff // Cyan
    },
    {
        id: 'flora',
        name: 'Lush Flora',
        prompt: 'exotic botanical garden with intricate leaf patterns and vibrant blooming flowers showing macro nature details',
        image: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=800&q=80',
        color: 0x32cd32 // Lime Green
    }
];

export const STYLES = [
    {
        id: 'minimal',
        name: 'Minimalist',
        prompt: 'minimalist visual style with crisp clean lines and flat muted colors using spacious negative composition',
        image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80'
    },
    {
        id: 'oil',
        name: 'Oil Paint',
        prompt: 'traditional oil painting style with rich textured brush strokes and impasto depth evoking timeless classical art',
        image: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&q=80'
    },
    {
        id: 'neon',
        name: 'Neon Glow',
        prompt: 'neon glow aesthetic with highly saturated cyber colors on a deep dark backdrop having synthwave retro vibes',
        image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80'
    },
    {
        id: 'sketch',
        name: 'Tech Sketch',
        prompt: 'technical blueprint schematic with fine white drafting lines on a dark background appearing precise and detailed',
        image: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=800&q=80'
    },
    {
        id: 'clay',
        name: '3D Clay',
        prompt: '3D clay sculpt render with soft studio lighting and matte smooth surfaces giving a handcrafted stop-motion vibe',
        image: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=800&q=80'
    },
    {
        id: 'noir',
        name: 'Film Noir',
        prompt: 'classic film noir aesthetic with stark black-and-white tones and high contrast featuring deep dramatic shadows',
        image: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&q=80'
    },
    {
        id: 'watercolor',
        name: 'Watercolor',
        prompt: 'dreamy watercolor painting with soft bleeding edges and flowing organic pigments showing artistic texture',
        image: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&q=80'
    },
    {
        id: 'pixel',
        name: 'Pixel Art',
        prompt: 'retro pixel art style from the nostalgic 16-bit era with crisp low-res sprites and a game aesthetic',
        image: 'https://images.unsplash.com/photo-1671750764695-10c7f164844c'
    },
    {
        id: 'anime',
        name: 'Anime Aesthetic',
        prompt: 'cinematic anime art with vivid radiant colors and refined linework including dramatic lighting inspired by Shinkai',
        image: 'https://plus.unsplash.com/premium_photo-1661964177687-57387c2cbd14'
    },
    {
        id: 'photoreal',
        name: 'Photorealistic',
        prompt: 'ultra-detailed photoreal render with sharp 8K clarity and volumetric light rays utilizing depth-of-field focus',
        image: 'https://images.unsplash.com/photo-1690626826406-c2fc0d344551'
    },
    {
        id: 'voxel',
        name: 'Voxel Art',
        prompt: 'charming voxel render made of cubic 3D pixel blocks in a crisp isometric layout with bright playful colors',
        image: 'https://images.unsplash.com/photo-1743306947426-06d3d970e58f'
    },
    {
        id: 'cinematic',
        name: 'Cinematic',
        prompt: 'wide-angle cinematic still with a bold dramatic color grade and deep shadows to achieve film-tier quality',
        image: 'https://images.unsplash.com/photo-1610847455028-9e55e62bac33'
    },
    {
        id: 'glitch',
        name: 'Glitch Effect',
        prompt: 'glitch digital distortion with corrupted data glitching and RGB chromatic split overlaid with vivid static noise',
        image: 'https://images.unsplash.com/photo-1634368998864-8984df61cdda'
    },
    {
        id: 'lowpoly',
        name: 'Low Poly',
        prompt: 'low-poly 3D render with faceted geometric forms and a soft pastel palette in clean minimalist scenery',
        image: 'https://images.unsplash.com/photo-1643143596361-a39511490214'
    },
    {
        id: 'bwphoto',
        name: 'B&W Photo',
        prompt: 'classic black and white photography with high contrast monochrome and grainy film texture looking timeless and vintage',
        image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80'
    },
    {
        id: 'classicpaint',
        name: 'Classic Painting',
        prompt: 'traditional fine art painting with visible brushwork and acrylic or gouache texture in an artistic composition',
        image: 'https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?w=800&q=80'
    },
    {
        id: 'graphic',
        name: 'Graphic Design',
        prompt: 'bold graphic design style with vector art aesthetics and strong typography elements containing flat distinct shapes',
        image: 'https://images.unsplash.com/photo-1586974087421-2ba56dab378c'
    },
     {
        id: 'hassalblad',
        name: 'Hassalblad',
        prompt: 'Shot on a Hasselblad X2D 100C with a 90mm f2.5 lens delivering an exceptionally sharp subject against a gorgeously creamy bokeh and hyper-realistic details while explicitly avoiding airbrushed or smoothed aesthetics to maintain subtle grain and rich deep tones of Portra 400 film',
        image: 'https://images.unsplash.com/photo-1699229483394-f6eda2c50262'
    },
    {
        id: 'ink',
        name: 'Ink Wash',
        prompt: 'traditional ink wash painting in sumi-e style with monochromatic flowing ink and minimalist brush strokes',
        image: 'https://images.unsplash.com/photo-1515405295579-ba7b45403062?w=800&q=80'
    },
    {
        id: 'modernist',
        name: 'Modernist',
        prompt: 'mid-century modernist art with Bauhaus influence and geometric abstraction using primary colors and clean structure',
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

// New Array to ensure uniqueness
export const RANDOM_MODIFIERS = [
    'illuminated by bioluminescent lighting',
    'shrouded in mysterious thick fog',
    'with a chaotic energy',
    'in a state of perfect symmetry',
    'viewed through a fisheye lens',
    'with floating debris in the air',
    'bathed in harsh cinematic spotlight',
    'with a slight chromatic aberration',
    'during a heavy rainstorm',
    'with sparkling dust particles',
    'under a double moon sky',
    'with intricate golden filigree details',
    'reflecting in a shattered mirror',
    'overgrown with wild vines',
    'frozen in time'
];

export const PROMPT_TEMPLATES = [
    'A serene {genre} scene designed in a {style} style featuring {color} tones',
    'Epic {genre} landscape rendered with a {style} aesthetic',
    'Minimalist {genre} composition treated with a {style} finish',
    'Dramatic {genre} vista depicted in a stunning {style} style',
    'Atmospheric {genre} environment brought to life with {style} rendering'
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
