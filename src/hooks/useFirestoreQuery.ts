
"use client";

import { useQuery } from '@tanstack/react-query';
import { getDocs, type Query, type QuerySnapshot, type DocumentData } from 'firebase/firestore';

// Default transformer function
const defaultTransformer = <T>(snapshot: QuerySnapshot<DocumentData>): T[] => {
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
};

/**
 * A custom hook to fetch Firestore data using TanStack Query.
 * @param queryKey A unique key for the query.
 * @param firestoreQuery The Firestore query to execute.
 * @param transformer An optional function to transform the snapshot data.
 * @returns The state of the query including data, error, and loading status.
 */
export const useFirestoreQuery = <T>(
    firestoreQuery: Query<DocumentData>,
    transformer: (snapshot: QuerySnapshot<DocumentData>) => T = defaultTransformer as any,
    queryKey?: any[],
) => {
    const key = queryKey || [firestoreQuery.path];

    const queryFn = async () => {
        const snapshot = await getDocs(firestoreQuery);
        return transformer(snapshot);
    };

    return useQuery<T, Error>({
        queryKey: key,
        queryFn,
    });
};
