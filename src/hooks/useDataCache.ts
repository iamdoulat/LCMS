"use client";

import { useEffect, useState, useCallback } from 'react';

interface CacheOptions {
    ttl?: number; // Time to live in milliseconds
    key: string;
}

/**
 * Custom hook for caching data with TTL support
 * Reduces Firestore reads by caching in memory and localStorage
 */
export function useDataCache<T>(options: CacheOptions) {
    const { key, ttl = 5 * 60 * 1000 } = options; // Default 5 minutes
    const [cachedData, setCachedData] = useState<T | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const cacheKey = `cache_${key}`;
    const timestampKey = `cache_${key}_timestamp`;

    // Check if cached data is still valid
    const isValid = useCallback(() => {
        if (typeof window === 'undefined') return false;

        const timestamp = localStorage.getItem(timestampKey);
        if (!timestamp) return false;

        const age = Date.now() - parseInt(timestamp);
        return age < ttl;
    }, [timestampKey, ttl]);

    // Get cached data
    const get = useCallback((): T | null => {
        if (cachedData) return cachedData;

        if (typeof window === 'undefined') return null;

        if (isValid()) {
            const data = localStorage.getItem(cacheKey);
            if (data) {
                try {
                    const parsed = JSON.parse(data);
                    setCachedData(parsed);
                    return parsed;
                } catch (error) {
                    console.error('Failed to parse cached data:', error);
                }
            }
        }

        return null;
    }, [cacheKey, cachedData, isValid]);

    // Set cache data
    const set = useCallback((data: T) => {
        setCachedData(data);

        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem(cacheKey, JSON.stringify(data));
                localStorage.setItem(timestampKey, Date.now().toString());
            } catch (error) {
                console.error('Failed to cache data:', error);
            }
        }
    }, [cacheKey, timestampKey]);

    // Clear cache
    const clear = useCallback(() => {
        setCachedData(null);
        if (typeof window !== 'undefined') {
            localStorage.removeItem(cacheKey);
            localStorage.removeItem(timestampKey);
        }
    }, [cacheKey, timestampKey]);

    // Fetch with cache
    const fetchWithCache = useCallback(
        async (fetcher: () => Promise<T>): Promise<T> => {
            // Try cache first
            const cached = get();
            if (cached) {
                return cached;
            }

            // Fetch if no valid cache
            setIsLoading(true);
            try {
                const data = await fetcher();
                set(data);
                return data;
            } finally {
                setIsLoading(false);
            }
        },
        [get, set]
    );

    return {
        cachedData,
        isLoading,
        get,
        set,
        clear,
        fetchWithCache,
        isValid: isValid(),
    };
}

/**
 * Global cache manager for invalidating related caches
 */
export const cacheManager = {
    clearAll: () => {
        if (typeof window !== 'undefined') {
            const keys = Object.keys(localStorage);
            keys.forEach((key) => {
                if (key.startsWith('cache_')) {
                    localStorage.removeItem(key);
                }
            });
        }
    },

    clearByPrefix: (prefix: string) => {
        if (typeof window !== 'undefined') {
            const keys = Object.keys(localStorage);
            keys.forEach((key) => {
                if (key.startsWith(`cache_${prefix}`)) {
                    localStorage.removeItem(key);
                }
            });
        }
    },
};
