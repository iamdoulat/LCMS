"use client";

import { useState, useEffect, useRef } from 'react';
import {
    Query,
    onSnapshot,
    QuerySnapshot,
    DocumentData,
    DocumentSnapshot,
    doc,
    getFirestore,
    DocumentReference
} from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';

interface RealtimeDataOptions<T> {
    transform?: (snapshot: QuerySnapshot<DocumentData>) => T;
    onData?: (data: T) => void;
    onError?: (error: Error) => void;
    enabled?: boolean;
}

interface RealtimeDocOptions<T> {
    transform?: (snapshot: DocumentSnapshot<DocumentData>) => T;
    onData?: (data: T) => void;
    onError?: (error: Error) => void;
    enabled?: boolean;
}

export function useRealtimeData<T>(
    query: Query<DocumentData> | null,
    options: RealtimeDataOptions<T> = {}
) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const { transform, onData, onError, enabled = true } = options;

    useEffect(() => {
        if (!query || !enabled) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const unsubscribe = onSnapshot(
            query,
            (snapshot) => {
                const transformedData = transform
                    ? transform(snapshot)
                    : snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as unknown as T;

                setData(transformedData);
                onData?.(transformedData);
                setLoading(false);
                setError(null);
            },
            (err) => {
                console.error("Firestore Realtime Error:", err);
                setError(err as Error);
                onError?.(err as Error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [query, enabled]);

    return { data, loading, error };
}

export function useRealtimeDoc<T>(
    docRef: DocumentReference<DocumentData> | null,
    options: RealtimeDocOptions<T> = {}
) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const { transform, onData, onError, enabled = true } = options;

    useEffect(() => {
        if (!docRef || !enabled) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const unsubscribe = onSnapshot(
            docRef,
            (snapshot) => {
                const transformedData = transform
                    ? transform(snapshot)
                    : (snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } as unknown as T : null);

                setData(transformedData);
                if (transformedData !== null) {
                    onData?.(transformedData as T);
                }
                setLoading(false);
                setError(null);
            },
            (err) => {
                console.error("Firestore Realtime Doc Error:", err);
                setError(err as Error);
                onError?.(err as Error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [docRef, enabled]);

    return { data, loading, error };
}
