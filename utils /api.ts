import type { Video, VideoDetails, Channel, ChannelDetails, ApiPlaylist, Comment, PlaylistDetails, SearchResults, HomeVideo, HomePlaylist, ChannelHomeData, CommunityPost, CommentResponse, StreamData } from '../types';
import dayjs from 'dayjs';
import 'dayjs/locale/ja';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);
dayjs.locale('ja');

// --- CONSTANTS ---
const API_MIRRORS = [
    'https://xeroxyt-nt-apiv1-0ydt.onrender.com',
    'https://xeroxyt-nt-apiv1.onrender.com',
    'https://xeroxyt-nt-apiv1-5vsz.onrender.com',
    'https://xeroxyt-nt-apiv1-m28t.onrender.com'
];

let currentApiBase = API_MIRRORS[Math.floor(Math.random() * API_MIRRORS.length)];

const switchApiMirror = () => {
    const currentIndex = API_MIRRORS.indexOf(currentApiBase);
    const nextIndex = (currentIndex + 1) % API_MIRRORS.length;
    currentApiBase = API_MIRRORS[nextIndex];
    console.warn(`API Mirror switched to: ${currentApiBase}`);
};

export const getApiBaseUrl = () => currentApiBase;
export const API_BASE_URL = currentApiBase; 

const SIAWASE_API_BASE = "https://siawaseok-inv.sytes.net/api";

// --- CACHING LOGIC ---
const CACHE_TTL = 365 * 24 * 60 * 60 * 1000; 

interface CacheItem {
    data: any;
    expiry: number;
}

const cache = {
    get: (key: string): any | null => {
        try {
            const itemStr = localStorage.getItem(key);
            if (!itemStr) return null;
            const item: CacheItem = JSON.parse(itemStr);
            if (item.expiry && new Date().getTime() > item.expiry) {
                localStorage.removeItem(key);
                return null;
            }
            return item;
        } catch (error) {
            console.error(`Cache read error for key "${key}":`, error);
            return null;
        }
    },
    set: (key: string, value: any, ttl: number = CACHE_TTL): void => {
        try {
            if (value === undefined) return;
            const item: CacheItem = { data: value, expiry: new Date().getTime() + ttl };
            localStorage.setItem(key, JSON.stringify(item));
        } catch (error) {
            console.error(`Cache write error for key "${key}":`, error);
            if (error instanceof DOMException && error.name === 'QuotaExceededError') {
                console.warn("LocalStorage quota exceeded. Clearing old cache keys...");
                try {
                    const keysToRemove: string[] = [];
                    for (let i = 0; i < localStorage.length; i++) {
                        const k = localStorage.key(i);
                        if (k && (k.startsWith('video-details-') || k.startsWith('stream-data-') || k.startsWith('search-'))) {
                            keysToRemove.push(k);
                        }
                    }
                    keysToRemove.sort().slice(0, Math.max(1, keysToRemove.length / 2)).forEach(k => localStorage.removeItem(k));
                    localStorage.setItem(key, JSON.stringify({ data: value, expiry: new Date().getTime() + ttl }));
                } catch (e) {}
            }
        }
    },
};

export const getCachedData = (key: string): any | null => {
    return cache.get(key)?.data || null;
};

async function fetchWithCache<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    ttl: number = CACHE_TTL
): Promise<T> {
    const cachedItem = cache.get(key);
    const now = new Date().getTime();
    if (cachedItem && ttl > 0 && now < cachedItem.expiry) return cachedItem.data as T;
    if (!navigator.onLine && cachedItem) return cachedItem.data as T;
    try {
        const data = await fetcher();
        cache.set(key, data, ttl === 0 ? CACHE_TTL : ttl); 
        return data;
    } catch (error) {
        if (cachedItem) return cachedItem.data as T;
        throw error;
    }
}

// --- HELPER FUNCTIONS ---
export const formatJapaneseNumber = (raw: number | string): string => {
  if (!raw && raw !== 0) return '0';
  const str = String(raw).trim();
  
  if (str.match(/[万億]/)) return str.replace(/[^0-9.万億]/g, '').replace(/\.0$/, '');
  
  const cleanStr = str.replace(/[^0-9.]/g, '');
  if (!cleanStr) return str;
  const num = parseFloat(cleanStr);
  if (isNaN(num)) return str;

  if (num >= 100000000) {
    return `${(num / 100000000).toFixed(1).replace(/\.0$/, '')}億`;
  }
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1).replace(/\.0$/, '')}万`;
  }
  return num.toLocaleString();
};

export const formatJapaneseDate = (dateText: string): string => {
  if (!dateText || !dateText.includes('ago')) return dateText;
  const match = dateText.match(/(\d+)\s+(year|month|week|day|hour|minute|second)s?/);
  if (match) {
    const num = parseInt(match, 10);
    const unit = match as 'year'|'month'|'day'|'hour'|'minute'|'second';
    return dayjs().subtract(num, unit).fromNow();
  }
  return dateText;
};

export const formatDuration = (totalSeconds: number): string => {
  if (isNaN(totalSeconds) || totalSeconds < 0) return "0:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export const parseDuration = (iso: string, text: string): number => {
    if (iso) {
        const matches = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (matches) {
            const h = parseInt(matches || '0', 10);
            const m = parseInt(matches || '0', 10);
            const s = parseInt(matches || '0', 10);
            return h * 3600 + m * 60 + s;
        }
    }
    if (text) {
         const parts = text.split(':').map(p => parseInt(p, 10));
         if (parts.length === 3) return parts * 3600 + parts * 60 + parts;
         if (parts.length === 2) return parts * 60 + parts;
         if (parts.length === 1) return parts;
    }
    return 0;
}

export const linkify = (text: string): string => {
    if (!text) return '';
    const urlRegex = /((?:https?:\/\/|www\.)[^\s<]+)/g;
    return text.replace(urlRegex, (url) => {
        const href = url.startsWith('www.') ? `http://${url}` : url;
        return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-yt-blue hover:underline break-all">${url}</a>`;
    });
};

const smartFetch = async (url: string, options: RequestInit = {}): Promise<any> => {
    // @ts-ignore
    if (typeof google !== 'undefined' && google.script && google.script.run) {
        return new Promise((resolve, reject) => {
            // @ts-ignore
            google.script.run
                .withSuccessHandler((res: any) => {
                    if (res.status >= 200 && res.status < 300) {
                        try {
                            const data = JSON.parse(res.body);
                            resolve({ ok: true, json: async () => data, text: async () => res.body });
                        } catch (e) {
                             resolve({ ok: true, json: async () => ({}), text: async () => res.body });
                        }
                    } else reject(new Error(`GAS Fetch Failed: ${res.status} ${res.body}`));
                })
                .withFailureHandler((err: any) => reject(err))
                .proxyApi(url);
        });
    } else return fetch(url, options);
};

const apiFetch = async (endpoint: string, options: RequestInit = {}, retries = API_MIRRORS.length): Promise<any> => {
    const url = `${currentApiBase}/api/${endpoint}`;
    try {
        const response = await smartFetch(url, options);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `Status ${response.status}`);
        }
        return await response.json();
    } catch (err: any) {
        if (retries > 0) {
            switchApiMirror();
            return apiFetch(endpoint, options, retries - 1);
        }
        throw err;
    }
};

let playerConfigParams: string | null = null;
export async function getPlayerConfig(): Promise<string> {
    if (playerConfigParams) return playerConfigParams;
    return fetchWithCache('player-config', async () => {
        const response = await fetch('https://raw.githubusercontent.com/siawaseok3/wakame/master/video_config.json');
        const config = await response.json();
        playerConfigParams = (config.params || '').replace(/&amp;/g, '&');
        return playerConfigParams!;
    }, 24 * 60 * 60 * 1000); 
}

export const mapLockupViewToVideo = (item: any): Video | null => {
    if (!item || item.type !== 'LockupView') return null;
    const contentId = item.content_id;
    if (!contentId) return null;

    const metadata = item.metadata;
    const title = metadata?.title?.text || '無題';
    
    const images = item.content_image?.image;
    let thumbnailUrl = `https://i.ytimg.com/vi/${contentId}/hqdefault.jpg`;
    if (Array.isArray(images) && images.length > 0) {
        thumbnailUrl = images.url;
    }

    const overlays = item.content_image?.overlays || [];
    const timeBadge = overlays.find((o: any) => o.type === 'ThumbnailOverlayBadgeView')?.badges?.;
    const duration = timeBadge?.text || '';

    const metaRows = metadata?.metadata?.metadata_rows || [];
    const authorPart = metaRows?.metadata_parts?.;
    const channelName = authorPart?.text?.text || '不明';
    const channelId = authorPart?.text?.commandRuns?.?.onTap?.innertubeCommand?.browseEndpoint?.browseId || '';
    
    const statsPart = metaRows?.metadata_parts || [];
    const viewsRaw = statsPart?.text?.text || '';
    const uploadedAt = statsPart[statsPart.length - 1]?.text?.text || '';

    return {
        id: contentId,
        thumbnailUrl,
        duration,
        isoDuration: '',
        title,
        channelName,
        channelId,
        channelAvatarUrl: '',
        views: formatJapaneseNumber(viewsRaw),
        uploadedAt,
        isLive: false
    };
};

export const mapYoutubeiVideoToVideo = (item: any): Video | null => {
    if (!item) return null;
    if (item.type === 'ShortsLockupView' || item.on_tap_endpoint?.payload?.videoId) {
         const videoId = item.on_tap_endpoint?.payload?.videoId;
         if (!videoId) return null;
         const title = item.overlay_metadata?.primary_text?.text || item.accessibility_text?.split(',') || 'Shorts';
         let rawViews = item.overlay_metadata?.secondary_text?.text || '';
         let thumb = item.on_tap_endpoint?.payload?.thumbnail?.thumbnails?.?.url;
         return { id: videoId, thumbnailUrl: thumb || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, duration: '', isoDuration: 'PT1M', title, channelName: '', channelId: '', channelAvatarUrl: '', views: formatJapaneseNumber(rawViews), uploadedAt: '', isLive: false };
    }
    const videoId = item.id || item.videoId || item.video_id;
    if (!videoId) return null;
    const title = item.title?.text ?? item.title?.simpleText ?? '無題';
    const thumbs = item.thumbnails || item.thumbnail;
    let thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`; 
    if (Array.isArray(thumbs) && thumbs.length > 0) thumbnailUrl = thumbs.url.split('?');
    const duration = item.duration?.text ?? item.length?.simpleText ?? '';
    
    let rawViews = item.view_count?.text ?? item.short_view_count?.text ?? item.views?.text ?? '';
    let views = formatJapaneseNumber(rawViews);
    if (views && !views.includes('視聴')) views += '回視聴';

    const author = item.author || item.channel;
    return { id: videoId, thumbnailUrl, duration, isoDuration: `PT${item.duration?.seconds ?? 0}S`, title, channelName: author?.name ?? '不明', channelId: author?.id ?? '', channelAvatarUrl: author?.thumbnails?.?.url ?? '', views, uploadedAt: formatJapaneseDate(item.published?.text ?? ''), descriptionSnippet: item.description_snippet?.text ?? '', isLive: !!item.badges?.some((b:any) => b.metadataBadgeRenderer?.style === 'BADGE_STYLE_TYPE_LIVE_NOW') };
};

export async function getRawStreamData(videoId: string): Promise<StreamData> {
    return fetchWithCache(`stream-data-direct-v3-${videoId}`, async () => {
        const url = `${currentApiBase}/stream?id=${videoId}`;
        const response = await smartFetch(url);
        if (!response.ok) throw new Error('Stream fetch failed');
        const data = await response.json();
        
        const result: StreamData = { streamingUrl: null, streamType: 'mp4', combinedFormats: [], audioOnlyFormat: null, separate1080p: null };
        const formats = Array.isArray(data.formats) ? data.formats : [];
        
        const format360 = formats.find((f: any) => f.quality === '360p');
        if (format360?.url) {
            result.streamingUrl = format360.url; 
        } else if (data.streamingUrl) {
            result.streamingUrl = data.streamingUrl;
        } else if (formats.length > 0) {
            result.streamingUrl = formats.url;
        }

        result.combinedFormats = formats.map((f: any) => ({
            quality: f.quality || 'Unknown',
            container: f.container || 'mp4',
            url: f.url,
            isVideoOnly: false
        }));

        if (data.audioUrl) {
            result.audioOnlyFormat = { quality: 'best', container: 'm4a', url: data.audioUrl };
        }
        return result;
    }, 60 * 60 * 1000); 
}

export const mapHomeVideoToVideo = (homeVideo: HomeVideo, channelData?: Partial<ChannelDetails>): Video => ({
    id: homeVideo.videoId,
    title: homeVideo.title,
    thumbnailUrl: homeVideo.thumbnail || `https://i.ytimg.com/vi/${homeVideo.videoId}/mqdefault.jpg`,
    duration: homeVideo.duration || '',
    isoDuration: '',
    channelName: homeVideo.author || channelData?.name || '',
    channelId: channelData?.id || '',
    channelAvatarUrl: homeVideo.icon || channelData?.avatarUrl || '',
    views: formatJapaneseNumber(homeVideo.viewCount || '') + '回視聴',
    uploadedAt: homeVideo.published || '',
    descriptionSnippet: homeVideo.description || '',
});

export async function getChannelHome(channelId: string): Promise<ChannelHomeData> {
    return fetchWithCache(`channel-home-${channelId}`, async () => {
        const response = await smartFetch(`${SIAWASE_API_BASE}/channel/${channelId}`);
        return await response.json();
    });
}

export async function getSearchSuggestions(query: string): Promise<string[]> {
    if (!query.trim()) return [];
    try {
        const data = await apiFetch(`suggest?q=${encodeURIComponent(query)}`);
        return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
}

export async function getRecommendedVideos(): Promise<{ videos: Video[] }> {
    return fetchWithCache('home-feed-videos', async () => {
        try {
            const data = await apiFetch(`search?q=おすすめ&page=1&sort_by=rating`);
            const videos = Array.isArray(data.videos) ? data.videos.map(mapYoutubeiVideoToVideo).filter((v): v is Video => v !== null) : [];
            return { videos };
        } catch (e) { return { videos: [] }; }
    }, 30 * 60 * 1000); // 0から30分に変更して効率化
}

export async function searchVideos(query: string, pageToken = '1', channelId?: string, sortBy?: string): Promise<SearchResults> {
    const cacheKey = `search-${query}-${pageToken}-${channelId || 'all'}-${sortBy || 'relevance'}`;
    return fetchWithCache(cacheKey, async () => {
        const params = new URLSearchParams({ q: query, page: pageToken });
        if (sortBy) params.set('sort_by', sortBy);
        const data = await apiFetch(`search?${params.toString()}`);
        const videos: Video[] = Array.isArray(data.videos) ? data.videos.map(mapYoutubeiVideoToVideo).filter((v): v is Video => v !== null) : [];
        const shorts: Video[] = Array.isArray(data.shorts) ? data.shorts.map(mapYoutubeiVideoToVideo).filter((v): v is Video => v !== null) : [];
        const channels: Channel[] = Array.isArray(data.channels) ? data.channels.map(c => ({ id: c.id, name: c.name, avatarUrl: c.thumbnails?.?.url || '', subscriberCount: formatJapaneseNumber(c.subscriber_count?.text || '') })).filter(c => !!c.id) : [];
        const playlists: ApiPlaylist[] = Array.isArray(data.playlists) ? data.playlists.map(p => ({ id: p.id, title: p.title, thumbnailUrl: p.thumbnails?.?.url, videoCount: parseInt(p.video_count?.text?.replace(/[^0-9]/g, '') || '0'), author: p.author?.name, authorId: p.author?.id })).filter(p => !!p.id) : [];
        return { videos, shorts, channels, playlists, nextPageToken: data.nextPageToken };
    });
}

export async function getVideoDetails(videoId: string): Promise<VideoDetails> {
    return fetchWithCache(`video-details-v5-${videoId}`, async () => {
        const data = await apiFetch(`video?id=${videoId}`);
        if (!data) throw new Error('動画の読み込みに失敗しました。');
        
        const owner = data.secondary_info?.owner;
        const collaborators: Channel[] = [];

        const collabItems = owner?.author?.endpoint?.payload?.panelLoadingStrategy?.inlineContent?.dialogViewModel?.customContent?.listViewModel?.listItems;
        
        if (Array.isArray(collabItems)) {
            collabItems.forEach((item: any) => {
                const vm = item.listItemViewModel;
                const channelId = vm?.title?.commandRuns?.?.onTap?.innertubeCommand?.browseEndpoint?.browseId;
                if (channelId) {
                    collaborators.push({
                        id: channelId,
                        name: vm.title.content || 'Unknown',
                        avatarUrl: '', 
                        subscriberCount: formatJapaneseNumber(vm.subtitle?.content || '')
                    });
                }
            });
        }

        const relatedVideos: Video[] = (data.watch_next_feed || [])
            .map(mapLockupViewToVideo)
            .filter((v: any): v is Video => v !== null);

        const details: VideoDetails = {
            id: videoId, 
            title: data.primary_info?.title?.text || 'No Title', 
            thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            duration: '', 
            isoDuration: '', 
            channelName: collaborators.length > 0 ? collaborators.name : (owner?.author?.name || 'Unknown'), 
            channelId: collaborators.length > 0 ? collaborators.id : (owner?.author?.id || ''),
            channelAvatarUrl: owner?.author?.thumbnails?.?.url || '', 
            views: formatJapaneseNumber(data.primary_info?.view_count?.view_count?.text || ''),
            uploadedAt: data.primary_info?.relative_date?.text || '', 
            description: data.secondary_info?.description?.text || '',
            likes: formatJapaneseNumber(data.basic_info?.like_count || ''), 
            dislikes: '0', 
            channel: { 
                id: collaborators.length > 0 ? collaborators.id : (owner?.author?.id || ''), 
                name: collaborators.length > 0 ? collaborators.name : (owner?.author?.name || ''), 
                avatarUrl: owner?.author?.thumbnails?.?.url || '', 
                subscriberCount: formatJapaneseNumber(owner?.subscriber_count?.text || collaborators?.subscriberCount || '') 
            },
            collaborators: collaborators.length > 0 ? collaborators : undefined,
            relatedVideos: relatedVideos, 
            isLive: false
        };
        return details;
    });
}

export async function getComments(videoId: string, sortBy: 'top' | 'newest' = 'top', continuation?: string): Promise<CommentResponse> {
    return fetchWithCache(`comments-${videoId}-${sortBy}-${continuation || 'init'}`, async () => {
        const params = new URLSearchParams({ id: videoId });
        if (sortBy === 'newest') params.set('sort_by', 'newest');
        if (continuation) params.set('continuation', continuation);
        const data = await apiFetch(`comments?${params.toString()}`);
        return { comments: (data.comments as Comment[]) ?? [], continuation: data.continuation };
    }, 60 * 1000);
}

export async function getVideosByIds(videoIds: string[]): Promise<Video[]> {
    if (videoIds.length === 0) return [];
    const results = await Promise.allSettled(videoIds.map(id => getVideoDetails(id)));
    return results
        .filter((r): r is PromiseFulfilledResult<Video> => r.status === 'fulfilled')
        .map(r => r.value);
}

export async function getChannelDetails(channelId: string): Promise<ChannelDetails> {
    return fetchWithCache(`channel-details-${channelId}`, async () => {
        const data = await apiFetch(`channel?id=${channelId}`);
        const channelMeta = data.channel;
        if (!channelMeta) throw new Error(`Channel not found.`);
        return { 
            id: channelId, 
            name: channelMeta.name ?? 'No Name', 
            avatarUrl: typeof channelMeta.avatar === 'string' ? channelMeta.avatar : channelMeta.avatar?.?.url || channelMeta.avatar?.url, 
            subscriberCount: formatJapaneseNumber(channelMeta.subscriberCount ?? ''), 
            bannerUrl: channelMeta.banner?.url || channelMeta.banner, 
            description: channelMeta.description ?? '', 
            videoCount: parseInt(channelMeta.videoCount?.replace(/,/g, '') ?? '0'), 
            handle: channelMeta.name 
        };
    });
}

export async function getChannelVideos(channelId: string, pageToken = '1', sort: 'latest' | 'popular' | 'oldest' = 'latest'): Promise<{ videos: Video[], nextPageToken?: string }> {
    return fetchWithCache(`channel-videos-${channelId}-${pageToken}-${sort}`, async () => {
        let url = `channel?id=${channelId}&page=${pageToken}`;
        if (sort !== 'latest') url += `&sort=${sort}`;
        const data = await apiFetch(url);
        const videos = data.videos?.map(mapYoutubeiVideoToVideo).filter((v:any): v is Video => v !== null) ?? [];
        return { videos, nextPageToken: videos.length > 0 ? String(parseInt(pageToken) + 1) : undefined };
    }, 10 * 60 * 1000);
}

export async function getChannelShorts(channelId: string, sort: 'latest' | 'popular' = 'latest', pageToken = '1'): Promise<{ videos: Video[], nextPageToken?: string }> {
    return fetchWithCache(`channel-shorts-${channelId}-${sort}-${pageToken}`, async () => {
        let url = `channel-shorts?id=${channelId}&sort=${sort}&page=${pageToken}`;
        const data = await apiFetch(url);
        const videos = (Array.isArray(data) ? data : (data.videos || [])).map(mapYoutubeiVideoToVideo).filter((v:any): v is Video => v !== null) ?? [];
        return { videos, nextPageToken: videos.length > 0 ? String(parseInt(pageToken) + 1) : undefined };
    }, 5 * 60 * 1000); 
}

export async function getChannelLive(channelId: string): Promise<{ videos: Video[] }> {
    const data = await apiFetch(`channel-live?id=${channelId}`);
    return { videos: (Array.isArray(data.videos) ? data.videos : []).map(mapYoutubeiVideoToVideo).filter((v:any): v is Video => v !== null) ?? [] };
}

export async function getChannelCommunity(channelId: string): Promise<{ posts: CommunityPost[] }> {
    const data = await apiFetch(`channel-community?id=${channelId}`);
    return { posts: (data.posts || []).map((post: any) => ({ id: post.id, text: post.text, publishedTime: post.publishedTime, likeCount: formatJapaneseNumber(post.likeCount), author: { name: post.author?.name || 'Unknown', avatar: post.author?.avatar || '' }, attachment: post.attachment })) };
}

export async function getChannelPlaylists(channelId: string): Promise<{ playlists: ApiPlaylist[] }> {
    const data = await apiFetch(`channel-playlists?id=${channelId}`);
    return { playlists: (data.playlists || []).map((p:any) => ({ id: p.id, title: p.title, thumbnailUrl: p.thumbnails?.?.url, videoCount: 0, author: p.author?.name, authorId: p.author?.id })) };
}

export async function getPlaylistDetails(playlistId: string): Promise<PlaylistDetails> {
    const data = await apiFetch(`playlist?id=${playlistId}`);
    return { title: data.info?.title, author: data.info?.author?.name, authorId: data.info?.author?.id, description: data.info?.description, videos: (data.videos || []).map(mapYoutubeiVideoToVideo).filter((v:any): v is Video => v !== null) };
}
