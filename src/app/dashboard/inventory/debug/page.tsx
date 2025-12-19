
"use client";

import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function InventoryDebugPage() {
    const [item, setItem] = useState<any>(null);
    const [categories, setCategories] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                addLog("Fetching item JcyBIz3i3tjrTHeumq23...");
                // 1. Fetch Item
                const itemsQ = query(collection(firestore, "items"));
                // Note: fetching all items is inefficient but safe for debug of one item if we filter client side, 
                // to avoid index issues with specific 'where' clauses if they don't exist.
                const itemsSnap = await getDocs(itemsQ);
                const foundItem = itemsSnap.docs.find(d => d.id === 'JcyBIz3i3tjrTHeumq23');
                if (foundItem) {
                    setItem({ id: foundItem.id, ...foundItem.data() });
                    addLog(`Item found: ${foundItem.id}`);
                    addLog(`Item Category Field: ${JSON.stringify(foundItem.data().category)}`);
                    addLog(`Item Section Field: ${JSON.stringify(foundItem.data().itemSection)}`);
                } else {
                    addLog("Item JcyBIz3i3tjrTHeumq23 NOT FOUND in list.");
                }

                // 2. Fetch Categories
                addLog("Fetching item_categories...");
                const catsQ = query(collection(firestore, "item_categories"));
                const catsSnap = await getDocs(catsQ);
                setCategories(catsSnap.docs.map(d => d.data()));
                addLog(`Categories found: ${catsSnap.size}`);
                if (catsSnap.size > 0) addLog(`First Cat: ${JSON.stringify(catsSnap.docs[0].data())}`);

                // 3. Fetch Sections
                addLog("Fetching item_sections...");
                const secsQ = query(collection(firestore, "item_sections"));
                const secsSnap = await getDocs(secsQ);
                setSections(secsSnap.docs.map(d => d.data()));
                addLog(`Sections found: ${secsSnap.size}`);

            } catch (err: any) {
                addLog(`ERROR: ${err.message}`);
            }
        };
        fetchData();
    }, []);

    return (
        <div className="p-10 space-y-4">
            <Card>
                <CardHeader><CardTitle>Debug Logs</CardTitle></CardHeader>
                <CardContent>
                    <pre className="bg-slate-950 text-white p-4 rounded-md overflow-auto h-64">
                        {logs.join('\n')}
                    </pre>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Item Data</CardTitle></CardHeader>
                <CardContent>
                    <pre className="bg-slate-100 p-4 rounded-md overflow-auto">
                        {JSON.stringify(item, null, 2)}
                    </pre>
                </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
                <Card>
                    <CardHeader><CardTitle>Categories ({categories.length})</CardTitle></CardHeader>
                    <CardContent>
                        <pre className="bg-slate-100 p-4 rounded-md overflow-auto max-h-64">
                            {JSON.stringify(categories, null, 2)}
                        </pre>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Sections ({sections.length})</CardTitle></CardHeader>
                    <CardContent>
                        <pre className="bg-slate-100 p-4 rounded-md overflow-auto max-h-64">
                            {JSON.stringify(sections, null, 2)}
                        </pre>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
