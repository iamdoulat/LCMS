"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface FirestoreSuspensionContextType {
    isSuspended: boolean;
    setSuspended: (suspended: boolean) => void;
}

const FirestoreSuspensionContext = createContext<FirestoreSuspensionContextType>({
    isSuspended: false,
    setSuspended: () => { },
});

export const useFirestoreSuspension = () => useContext(FirestoreSuspensionContext);

export function FirestoreSuspensionProvider({ children }: { children: ReactNode }) {
    const [isSuspended, setIsSuspended] = useState(false);

    return (
        <FirestoreSuspensionContext.Provider value={{ isSuspended, setSuspended: setIsSuspended }}>
            {children}
        </FirestoreSuspensionContext.Provider>
    );
}
