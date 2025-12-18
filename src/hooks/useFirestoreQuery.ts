
"use client";

import { useQuery } from '@tanstack/react-query';
import { getDocs, type Query, type QuerySnapshot, type DocumentData } from 'firebase/firestore';

// Default transformer function
const defaultTransformer = <T>(snapshot: QuerySnapshot<DocumentData>): T[] => {
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
};

/**
 * A custom hook to fetch Firestore data using TanStack Query.
 * @param firestoreQuery The Firestore query to execute.
 * @param transformer An optional function to transform the snapshot data.
 * @param queryKey A unique key for the query, required for caching and refetching.
 * @param enabled A boolean to enable or disable the query.
 * @returns The state of the query including data, error, and loading status.
 */
export const useFirestoreQuery = <T>(
    firestoreQuery: Query<DocumentData>,
    transformer?: (snapshot: QuerySnapshot<DocumentData>) => T,
    queryKey?: any[],
    enabled: boolean = true, // Add the enabled option with a default value
) => {
    // A query key is required for TanStack Query to work correctly.
    // We use a combination of the query's path and any additional keys.
    const key = queryKey || [(firestoreQuery as any)._query.path.segments.join('/')];

    const queryFn = async () => {
        const snapshot = await getDocs(firestoreQuery);
        // Use the provided transformer or the default one.
        const transformFn = transformer || (defaultTransformer as (snapshot: QuerySnapshot<DocumentData>) => T);
        return transformFn(snapshot);
    };

    return useQuery<T, Error>({
        queryKey: key,
        queryFn,
        enabled, // Pass the enabled option to useQuery
    });
};
