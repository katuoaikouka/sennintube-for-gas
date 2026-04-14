import type { Video, Channel } from '../types';
import { searchVideos, getRecommendedVideos, parseDuration } from './api';
import { extractKeywords, calculateMagnitude, isJapaneseText } from './xrai';
import type { BlockedChannel, HiddenVideo } from '../contexts/PreferenceContext';

interface RecommendationSource {
    searchHistory: string[];
    watchHistory: Video[];
    shortsHistory?: Video[];
    subscribedChannels: Channel[];
    ngKeywords: string[];
    ngChannels: BlockedChannel[];
    hiddenVideos: HiddenVideo[];
    negativeKeywords: Map<string, number>;
    page: number;
}

export interface HomeFeed {
    videos: Video[];
    shorts: Video[];
}

const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

const cleanTitleForSearch = (title: string): string => {
    return title.replace(/【.*?】|\[.*?\]|\(.*?\)/g, '').trim().split(' ').slice(0, 4).join(' ');
};

const isShortVideo = (v: Video): boolean => {
    const seconds = parseDuration(v.isoDuration, v.duration);
    if (isNaN(seconds)) return v.title.toLowerCase().includes('#shorts');
    return (seconds > 0 && seconds <= 60) || v.title.toLowerCase().includes('#shorts');
};

// Timeout wrapper for individual fetch operations
const fetchWithTimeout = <T>(promise: Promise<T>, ms: number, fallbackValue: T): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<T>((resolve) => setTimeout(() => resolve(fallbackValue), ms))
    ]);
};

export const getXraiRecommendations = async (sources: RecommendationSource): Promise<HomeFeed> => {
    const { 
        watchHistory, 
        subscribedChannels,
        ngKeywords,
        ngChannels,
        hiddenVideos,
        negativeKeywords,
        page
    } = sources;

    const TARGET_VIDEOS = 100;
    const TRENDING_VIDEO_RATIO = 0.20; // 20% Trending, 80% Personalized
    const TARGET_SHORTS = 20;

    const seenIds = new Set<string>(hiddenVideos.map(v => v.id));
    const ngChannelIds = new Set(ngChannels.map(c => c.id));
    const lowerNgKeywords = ngKeywords.map(ng => ng.toLowerCase());

    const filterAndDedupe = (videos: Video[]): Video[] => {
        return videos.filter(v => {
            if (seenIds.has(v.id)) return false;
            
            const fullText = `${v.title} ${v.channelName}`.toLowerCase();

            if (lowerNgKeywords.some(ng => fullText.includes(ng))) return false;
            if (ngChannelIds.has(v.channelId)) return false;

            const vKeywords = [...extractKeywords(v.title), ...extractKeywords(v.channelName)];
            let negativeScore = 0;
            vKeywords.forEach(k => {
                if (negativeKeywords.has(k)) {
                    negativeScore += (negativeKeywords.get(k) || 0);
                }
            });
            if (negativeScore > 2) return false;
            
            seenIds.add(v.id);
            return true;
        });
    };

    // 1. Fetch Personalized Seeds
    let personalizedSeeds: string[] = [];
    if (watchHistory.length > 0) {
        const historySample = shuffleArray(watchHistory).slice(0, 7);
        personalizedSeeds = historySample.map(v => `${cleanTitleForSearch(v.title)} related`);
    } else if (subscribedChannels.length > 0) {
        const subSample = shuffleArray(subscribedChannels).slice(0, 5);
        personalizedSeeds = subSample.map(c => `${c.name} videos`);
    } else {
        personalizedSeeds = ["Music", "Gaming", "Vlog", "News", "Technology"];
    }

    const queryPage = Math.floor((page - 1) / 3) + 1;

    // 2. Fetch Content with Timeouts for Speed
    const trendingPromise = fetchWithTimeout(
        getRecommendedVideos().then(res => res.videos).catch(() => []),
        2500, 
        []
    );
    
    const searchPromises = personalizedSeeds.map(query => 
        fetchWithTimeout(
            searchVideos(query, String(queryPage)).then(res => ({ videos: res.videos, shorts: res.shorts })).catch(() => ({ videos: [], shorts: [] })),
            5000, 
            { videos: [], shorts: [] }
        )
    );
    
    const [trendingContent, personalizedResults] = await Promise.all([trendingPromise, Promise.all(searchPromises)]);

    // 3. Separate ALL content
    const allTrendingVideos: Video[] = [];
    const allTrendingShorts: Video[] = [];
    for (const v of trendingContent) {
        if (isShortVideo(v)) {
            allTrendingShorts.push(v);
        } else {
            allTrendingVideos.push(v);
        }
    }

    const allPersonalizedVideos: Video[] = [];
    const allPersonalizedShorts: Video[] = personalizedResults.flatMap(r => r.shorts);
    const personalizedVideosFromSearch = personalizedResults.flatMap(r => r.videos);
    for (const v of personalizedVideosFromSearch) {
        if (isShortVideo(v)) {
            allPersonalizedShorts.push(v);
        } else {
            allPersonalizedVideos.push(v);
        }
    }

    // 4. Filter and Dedupe
    const cleanTrendingVideos = filterAndDedupe(allTrendingVideos);
    const cleanPersonalizedVideos = filterAndDedupe(allPersonalizedVideos);
    const cleanTrendingShorts = filterAndDedupe(allTrendingShorts);
    const cleanPersonalizedShorts = filterAndDedupe(allPersonalizedShorts);

    // 5. Mix Videos
    const numTrending = Math.floor(TARGET_VIDEOS * TRENDING_VIDEO_RATIO);
    const numPersonalized = TARGET_VIDEOS - numTrending;
    
    const finalTrending = shuffleArray(cleanTrendingVideos).slice(0, numTrending);
    let finalPersonalized = shuffleArray(cleanPersonalizedVideos);
    
    finalPersonalized = finalPersonalized.slice(0, Math.max(numPersonalized, TARGET_VIDEOS - finalTrending.length));

    const finalVideos = shuffleArray([...finalTrending, ...finalPersonalized]);

    // 6. Mix Shorts
    const finalShorts = shuffleArray([
        ...shuffleArray(cleanTrendingShorts),
        ...shuffleArray(cleanPersonalizedShorts)
    ]).slice(0, TARGET_SHORTS);

    return { videos: finalVideos, shorts: finalShorts };
};


export const getXraiShorts = async (sources: RecommendationSource & { seenIds?: string[] }): Promise<Video[]> => {
    const { 
        watchHistory, 
        shortsHistory,
        subscribedChannels,
        hiddenVideos,
        ngChannels,
        ngKeywords,
        negativeKeywords,
        seenIds = [],
        page
    } = sources;

    // --- Configuration ---
    const BATCH_SIZE = 30; 
    const POPULAR_RATIO = 0.85; 
    const targetPopularCount = Math.ceil(BATCH_SIZE * POPULAR_RATIO);
    const targetPersonalizedCount = BATCH_SIZE - targetPopularCount;

    // --- User Profile Construction ---
    const userVector = new Map<string, number>();
    const addWeight = (text: string, weight: number) => {
        extractKeywords(text).forEach(k => userVector.set(k, (userVector.get(k) || 0) + weight));
    };

    subscribedChannels.forEach(c => addWeight(c.name, 5.0));
    (shortsHistory || []).slice(0, 30).forEach((v, i) => {
        const recencyDecay = Math.exp(-i / 10);
        addWeight(v.title, 3.0 * recencyDecay);
        addWeight(v.channelName, 4.0 * recencyDecay);
    });
    
    const userMag = calculateMagnitude(userVector); 

    // --- Candidate Generation ---
    const queryPage = Math.floor((page - 1) / 3) + 1;
    
    const popularQueries = [
        " #shorts", "急上昇 #shorts", "人気 #shorts", "バズってる #shorts", "面白い #shorts", 
        "切り抜き #shorts", "2ch #shorts", "映画ネタ #shorts", "#voicevox #shorts", "#twitter #shorts",
        "UCuP7Oceo9kOQ_tyUWadNmJA #shorts", "UCkYqAt7IJVwKCB3QCzdnpCA #shorts", "ショートドラマ #shorts",
        "ドラマ #shorts", "コント #shorts", "あるある #shorts", "雑学 #shorts", "豆知識 #shorts",
        "ライフハック #shorts", "解説 #shorts"
    ];
    const selectedQueries = shuffleArray(popularQueries).slice(0, 3);
    
    const popularPromise = Promise.all([
        fetchWithTimeout(getRecommendedVideos().then(res => res.videos.filter(isShortVideo)).catch(() => []), 2000, []),
        ...selectedQueries.map(q => fetchWithTimeout(searchVideos(q, String(queryPage)).then(res => [...res.videos, ...res.shorts].filter(isShortVideo)).catch(() => []), 3000, []))
    ]).then(results => results.flat() as Video[]);
    
    const topKeywords = [...userVector.entries()].sort((a, b) => b - a).slice(0, 3).map(e => e);
    const personalizedSeeds = topKeywords.length > 0 ? topKeywords.map(k => `${k} #shorts`) : ["音楽 #shorts"];
    const personalizedPromise = Promise.all(personalizedSeeds.map(query => 
        fetchWithTimeout(searchVideos(query, String(queryPage)).then(res => [...res.videos, ...res.shorts].filter(isShortVideo)).catch(() => []), 3000, [])
    )).then(results => results.flat() as Video[]);

    const [popularShortsRaw, personalizedShortsRaw] = await Promise.all([popularPromise, personalizedPromise]);

    // --- Filtering & Scoring ---
    const allSeenIds = new Set([
        ...(shortsHistory || []).map(v => v.id),
        ...hiddenVideos.map(v => v.id),
        ...seenIds
    ]);
    const ngChannelIds = new Set(ngChannels.map(c => c.id));
    const lowerNgKeywords = ngKeywords.map(ng => ng.toLowerCase());

    const scoreVideo = (video: Video, isPopularSource: boolean): number => {
        let score = isPopularSource ? 80 : 0;

        const vKeywords = [...extractKeywords(video.title), ...extractKeywords(video.channelName)];
        let dotProduct = 0;
        vKeywords.forEach(k => {
            if (userVector.has(k)) {
                dotProduct += userVector.get(k)!;
            }
        });
        
        if (userMag > 0 && vKeywords.length > 0) {
            score += (dotProduct / (userMag * Math.sqrt(vKeywords.length))) * 100;
        }

        if (subscribedChannels.some(c => c.id === video.channelId)) {
            score += 50; 
        }

        let negScore = 0;
        vKeywords.forEach(k => {
            if (negativeKeywords.has(k)) negScore += negativeKeywords.get(k)!;
        });
        score -= negScore * 30;

        score += Math.random() * 20;
        return score;
    };

    const processCandidates = (candidates: Video[], isPopularSource: boolean): { video: Video, score: number }[] => {
        const unique = new Map<string, Video>();
        candidates.forEach(v => {
            if (allSeenIds.has(v.id)) return;
            if (ngChannelIds.has(v.channelId)) return;
            const fullText = `${v.title} ${v.channelName}`.toLowerCase();
            if (lowerNgKeywords.some(ng => fullText.includes(ng))) return;
            
            if (!(isJapaneseText(v.title) || isJapaneseText(v.channelName))) return;

            if (!unique.has(v.id)) unique.set(v.id, v);
        });

        return Array.from(unique.values()).map(v => ({
            video: v,
            score: scoreVideo(v, isPopularSource)
        })).sort((a, b) => b.score - a.score);
    };

    const rankedPopular = processCandidates(popularShortsRaw, true);
    const rankedPersonalized = processCandidates(personalizedShortsRaw, false);

    const finalFeed: Video[] = [];
    const usedIds = new Set<string>();

    const addVideoSafely = (item: { video: Video, score: number } | undefined, isPopular: boolean) => {
        if (!item) return;
        if (item.score < (isPopular ? -100 : -50)) return;
        if (usedIds.has(item.video.id)) return;

        finalFeed.push(item.video);
        usedIds.add(item.video.id);
    };

    rankedPopular.slice(0, targetPopularCount).forEach(item => addVideoSafely(item, true));
    rankedPersonalized.slice(0, targetPersonalizedCount).forEach(item => addVideoSafely(item, false));

    let remainingNeeded = BATCH_SIZE - finalFeed.length;
    if (remainingNeeded > 0) {
        rankedPopular.slice(targetPopularCount, targetPopularCount + remainingNeeded).forEach(item => addVideoSafely(item, true));
    }
    
    remainingNeeded = BATCH_SIZE - finalFeed.length;
    if (remainingNeeded > 0) {
        rankedPersonalized.slice(targetPersonalizedCount, targetPersonalizedCount + remainingNeeded).forEach(item => addVideoSafely(item, false));
    }

    return shuffleArray(finalFeed);
};
