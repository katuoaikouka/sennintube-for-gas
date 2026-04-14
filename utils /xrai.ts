import type { Video, Channel } from '../types';

// --- Types ---

export interface UserProfile {
  keywords: Map<string, number>;
  magnitude: number;
}

interface UserSources {
  watchHistory: Video[];
  shortsHistory?: Video[];
  searchHistory: string[];
  subscribedChannels: Channel[];
}

// --- Keyword Extraction ---

// 精度向上のため、ノイズになりやすい単語を追加
const JAPANESE_STOP_WORDS = new Set([
  'の', 'に', 'は', 'を', 'が', 'で', 'です', 'ます', 'こと', 'もの', 'これ', 'それ', 'あれ',
  'いる', 'する', 'ある', 'ない', 'から', 'まで', 'と', 'も', 'や', 'など', 'さん', 'ちゃん',
  'くん', 'さま', 'まとめ', '解説', '実況', '放送', '配信', '紹介',
  'about', 'and', 'the', 'to', 'a', 'of', 'in', 'for', 'on', 'with', 'as', 'at', 'movie', 'video',
  'official', 'channel', 'music', 'mv', 'pv', 'tv', 'shorts', 'part', 'vol', 'no', 'ep'
]);

const segmenter = (typeof Intl !== 'undefined' && (Intl as any).Segmenter) 
    ? new (Intl as any).Segmenter('ja', { granularity: 'word' }) 
    : null;

export const extractKeywords = (text: string): string[] => {
  if (!text) return [];
  const cleanedText = text.toLowerCase();
  const wordSet = new Set<string>();

  if (segmenter) {
    const segments = segmenter.segment(cleanedText);
    for (const { segment, isWordLike } of segments) {
      if (isWordLike && segment.length > 1) {
        if (!JAPANESE_STOP_WORDS.has(segment) && !/^\d+$/.test(segment)) {
          wordSet.add(segment);
        }
      } else if (isWordLike && /^[a-zA-Z0-9]$/.test(segment)) {
        // 英数字1文字は許容（C言語のCなど）
        wordSet.add(segment);
      }
    }
  } else {
    // フォールバック: セグメンターがない環境
    const words = cleanedText.replace(/[\p{S}\p{P}\p{Z}\p{C}]/gu, ' ').split(/\s+/);
    for (const word of words) {
      if (word.length > 1 || /^[a-zA-Z0-9]$/.test(word)) {
        if (!JAPANESE_STOP_WORDS.has(word) && !/^\d+$/.test(word)) {
          wordSet.add(word);
        }
      }
    }
  }

  return Array.from(wordSet);
};

export const calculateMagnitude = (vector: Map<string, number>): number => {
    let sumSq = 0;
    for (const val of vector.values()) sumSq += val * val;
    return Math.sqrt(sumSq);
};

export const isJapaneseText = (text: string): boolean => {
    // 判定範囲をCJK全体に広げ、正規表現の生成コストを考慮して外出しも検討可能
    const jpRegex = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/;
    return jpRegex.test(text);
};

// --- User Profile Construction ---

export const buildUserProfile = (sources: UserSources): UserProfile => {
  const keywords = new Map<string, number>();

  const addKeywords = (text: string, weight: number) => {
    const kws = extractKeywords(text);
    for (let i = 0; i < kws.length; i++) {
      const kw = kws[i];
      keywords.set(kw, (keywords.get(kw) || 0) + weight);
    }
  };

  // 1. 検索履歴: ユーザーの直接的な意図（非常に高い重み付け）
  const searchLen = sources.searchHistory.length;
  for (let i = 0; i < Math.min(searchLen, 30); i++) {
    const weight = 8.0 * Math.exp(-i / 10);
    addKeywords(sources.searchHistory[i], weight);
  }

  // 2. 視聴履歴: 暗黙的な興味
  const watchLen = sources.watchHistory.length;
  for (let i = 0; i < Math.min(watchLen, 50); i++) {
    const video = sources.watchHistory[i];
    const recencyWeight = 5.0 * Math.exp(-i / 15);
    addKeywords(video.title, recencyWeight);
    addKeywords(video.channelName, recencyWeight * 1.5); // チャンネル名はトピックを強く反映する
  }

  // 3. ショート動画履歴
  if (sources.shortsHistory) {
    const shortsLen = sources.shortsHistory.length;
    for (let i = 0; i < Math.min(shortsLen, 30); i++) {
      const video = sources.shortsHistory[i];
      const recencyWeight = 3.5 * Math.exp(-i / 15);
      addKeywords(video.title, recencyWeight);
      addKeywords(video.channelName, recencyWeight * 1.5);
    }
  }

  // 4. 登録チャンネル: 長期的な興味（明示的）
  const subChannels = sources.subscribedChannels;
  for (let i = 0; i < subChannels.length; i++) {
    addKeywords(subChannels[i].name, 3.0);
  }
  
  return { keywords, magnitude: calculateMagnitude(keywords) };
};

export const inferTopInterests = (profile: UserProfile, limit: number = 6): string[] => {
    // パフォーマンス維持のため、上位のみを部分ソート
    return [...profile.keywords.entries()]
        .sort((a, b) => b - a)
        .slice(0, limit)
        .map(e => e);
};
