
"use client";

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, PlusCircle, Trash2, Edit, MoreHorizontal, Building, Wallet, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { firestore } from '@/lib/firebase/config';
import { collection, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import type { PettyCashAccountDocument, PettyCashCategoryDocument, ItemCategoryDocument, ItemVariationDocument, ItemSectionDocument } from '@/types';
import Swal from 'sweetalert2';
import { useAuth } from '@/context/AuthContext';
import { AddPettyCashAccountForm } from '@/components/forms/AddPettyCashAccountForm';
import { AddPettyCashCategoryForm } from '@/components/forms/AddPettyCashCategoryForm';
import { EditPettyCashAccountForm } from '@/components/forms/EditPettyCashAccountForm';
import { EditPettyCashCategoryForm } from '@/components/forms/EditPettyCashCategoryForm';
import { AddItemCategoryForm } from '@/components/forms/AddItemCategoryForm';
import { EditItemCategoryForm } from '@/components/forms/EditItemCategoryForm';
import { AddItemVariationForm } from '@/components/forms/AddItemVariationForm';
import { EditItemVariationForm } from '@/components/forms/EditItemVariationForm';
import { AddItemSectionForm } from '@/components/forms/AddItemSectionForm';

import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { Skeleton } from '@/components/ui/skeleton';


const DataTableSkeleton = () => (
    <div className="rounded-md border">
        <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right w-[50px]">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
                {Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </div>
);

const formatCurrency = (value?: number) => {
    if (typeof value !== 'number' || isNaN(value)) return `BDT N/A`;
    return `BDT ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};


import { AddCurrencyForm } from '@/components/forms/AddCurrencyForm';
import { EditCurrencyForm } from '@/components/forms/EditCurrencyForm';
import type { CurrencyDocument } from '@/types';

export default function PettyCashSettingsPage() {
    const { userRole } = useAuth();
    const isReadOnly = userRole?.includes('Viewer');

    const { data: accounts, isLoading: isLoadingAccounts } = useFirestoreQuery<PettyCashAccountDocument[]>(query(collection(firestore, 'petty_cash_accounts'), orderBy("name", "asc")), undefined, ['petty_cash_accounts']);
    const { data: categories, isLoading: isLoadingCategories } = useFirestoreQuery<PettyCashCategoryDocument[]>(query(collection(firestore, 'petty_cash_categories'), orderBy("name", "asc")), undefined, ['petty_cash_categories']);
    const { data: itemCategories, isLoading: isLoadingItemCategories } = useFirestoreQuery<ItemCategoryDocument[]>(query(collection(firestore, 'item_categories'), orderBy("createdAt", "desc")), undefined, ['item_categories']);
    const { data: itemVariations, isLoading: isLoadingItemVariations } = useFirestoreQuery<ItemVariationDocument[]>(query(collection(firestore, 'item_variations'), orderBy("createdAt", "desc")), undefined, ['item_variations']);
    const { data: itemSections, isLoading: isLoadingItemSections } = useFirestoreQuery<ItemSectionDocument[]>(query(collection(firestore, 'item_sections'), orderBy("createdAt", "desc")), undefined, ['item_sections']);
    const { data: currencies, isLoading: isLoadingCurrencies } = useFirestoreQuery<CurrencyDocument[]>(query(collection(firestore, 'currencies'), orderBy("createdAt", "desc")), undefined, ['currencies']);


    const [isAddAccountDialogOpen, setIsAddAccountDialogOpen] = React.useState(false);
    const [isAddCategoryDialogOpen, setIsAddCategoryDialogOpen] = React.useState(false);
    const [isAddItemCategoryDialogOpen, setIsAddItemCategoryDialogOpen] = React.useState(false);
    const [isAddItemVariationDialogOpen, setIsAddItemVariationDialogOpen] = React.useState(false);
    const [isAddItemSectionDialogOpen, setIsAddItemSectionDialogOpen] = React.useState(false);
    const [isAddCurrencyDialogOpen, setIsAddCurrencyDialogOpen] = React.useState(false);

    const [editingAccount, setEditingAccount] = React.useState<PettyCashAccountDocument | null>(null);
    const [isEditAccountDialogOpen, setIsEditAccountDialogOpen] = React.useState(false);

    const [editingCategory, setEditingCategory] = React.useState<PettyCashCategoryDocument | null>(null);
    const [isEditCategoryDialogOpen, setIsEditCategoryDialogOpen] = React.useState(false);

    const [editingItemCategory, setEditingItemCategory] = React.useState<ItemCategoryDocument | null>(null);
    const [isEditItemCategoryDialogOpen, setIsEditItemCategoryDialogOpen] = React.useState(false);

    const [editingItemVariation, setEditingItemVariation] = React.useState<ItemVariationDocument | null>(null);
    const [isEditItemVariationDialogOpen, setIsEditItemVariationDialogOpen] = React.useState(false);

    const [editingCurrency, setEditingCurrency] = React.useState<CurrencyDocument | null>(null);
    const [isEditCurrencyDialogOpen, setIsEditCurrencyDialogOpen] = React.useState(false);


    const handleEdit = (item: any, setEditingItem: React.Dispatch<any>, setIsEditDialogOpen: React.Dispatch<any>) => {
        setEditingItem(item);
        setIsEditDialogOpen(true);
    };

    const handleDelete = async (collectionName: string, docId: string, docName: string) => {
        if (isReadOnly) return;
        Swal.fire({
            title: `Delete '${docName}'?`,
            text: "This will permanently delete the item.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: 'hsl(var(--destructive))',
            confirmButtonText: 'Yes, delete it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deleteDoc(doc(firestore, collectionName, docId));
                    Swal.fire('Deleted!', `'${docName}' has been removed.`, 'success');
                } catch (error: any) {
                    Swal.fire('Error!', `Could not delete item: ${error.message}`, 'error');
                }
            }
        });
    };

    const renderTableSection = (
        title: string,
        description: string,
        data: any[] | undefined,
        isLoading: boolean,
        onAddClick: () => void,
        onEditClick: (item: any) => void,
        collectionName: string,
        className?: string
    ) => (
        <Card className={className}>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2"><Building className="h-5 w-5 text-primary" />{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </div>
                <Button size="sm" disabled={isReadOnly} onClick={onAddClick}><PlusCircle className="mr-2 h-4 w-4" />Add New</Button>
            </CardHeader>
            <CardContent>
                {isLoading ? <DataTableSkeleton /> :
                    !data || data.length === 0 ? <div className="text-muted-foreground text-center p-4">No data found.</div> :
                        (
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right w-[50px]">Actions</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {data.map(item => (
                                            <TableRow key={item.id}>
                                                <TableCell>
                                                    {item.name}
                                                    {collectionName === 'currencies' && <span className="text-xs text-muted-foreground ml-2">({item.code} - {item.symbol})</span>}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Open menu</span><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                            <DropdownMenuItem onClick={() => onEditClick(item)} disabled={isReadOnly}><Edit className="mr-2 h-4 w-4" /><span>Edit</span></DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => handleDelete(collectionName, item.id, item.name)} className="text-destructive focus:text-destructive" disabled={isReadOnly}><Trash2 className="mr-2 h-4 w-4" /><span>Delete</span></DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
            </CardContent>
        </Card>
    );

    return (
        <div className="container mx-auto py-8 px-5">
            <Card className="shadow-xl">
                <CardHeader>
                    <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                        <Settings className="h-7 w-7 text-primary" />
                        Petty Cash Settings
                    </CardTitle>
                    <CardDescription>
                        Manage source accounts and transaction categories for your petty cash.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Currency Configuration */}
                    <Dialog open={isAddCurrencyDialogOpen} onOpenChange={setIsAddCurrencyDialogOpen}>
                        {renderTableSection(
                            "Currency Configuration",
                            "Manage currencies (e.g., USD, BDT).",
                            currencies,
                            isLoadingCurrencies,
                            () => setIsAddCurrencyDialogOpen(true),
                            (item) => handleEdit(item, setEditingCurrency, setIsEditCurrencyDialogOpen),
                            'currencies',
                            // @ts-ignore
                            List
                        )}
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Add New Currency</DialogTitle>
                                <DialogDescription>Add a new currency for use in the application.</DialogDescription>
                            </DialogHeader>
                            <AddCurrencyForm onFormSubmit={() => setIsAddCurrencyDialogOpen(false)} />
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isAddCategoryDialogOpen} onOpenChange={setIsAddCategoryDialogOpen}>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2"><List className="h-5 w-5 text-primary" />Transaction Categories</CardTitle>
                                    <CardDescription>Organize your transactions.</CardDescription>
                                </div>
                                <Button size="sm" disabled={isReadOnly} onClick={() => setIsAddCategoryDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4" />Add Category</Button>
                            </CardHeader>
                            <CardContent>
                                {isLoadingCategories ? <DataTableSkeleton /> :
                                    !categories || categories.length === 0 ? <div className="text-muted-foreground text-center p-4">No categories found.</div> :
                                        (
                                            <div className="rounded-md border">
                                                <Table><TableHeader><TableRow><TableHead>Category Name</TableHead><TableHead className="text-right w-[50px]">Actions</TableHead></TableRow></TableHeader>
                                                    <TableBody>
                                                        {categories.map(cat => (
                                                            <TableRow key={cat.id}>
                                                                <TableCell>{cat.name}</TableCell>
                                                                <TableCell className="text-right">
                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0" disabled={isReadOnly}><span className="sr-only">Open menu</span><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                                        <DropdownMenuContent align="end">
                                                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                                            <DropdownMenuItem onClick={() => handleEdit(cat, setEditingCategory, setIsEditCategoryDialogOpen)} disabled={isReadOnly}><Edit className="mr-2 h-4 w-4" /><span>Edit</span></DropdownMenuItem>
                                                                            <DropdownMenuSeparator />
                                                                            <DropdownMenuItem onClick={() => handleDelete('petty_cash_categories', cat.id, cat.name)} className="text-destructive focus:text-destructive" disabled={isReadOnly}><Trash2 className="mr-2 h-4 w-4" /><span>Delete</span></DropdownMenuItem>
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody></Table>
                                            </div>
                                        )}
                            </CardContent>
                        </Card>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Add New Category</DialogTitle>
                                <DialogDescription>Create a new category to classify transactions.</DialogDescription>
                            </DialogHeader>
                            <AddPettyCashCategoryForm onFormSubmit={() => setIsAddCategoryDialogOpen(false)} />
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isAddAccountDialogOpen} onOpenChange={setIsAddAccountDialogOpen}>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" />Source of Accounts</CardTitle>
                                    <CardDescription>Manage accounts for transactions.</CardDescription>
                                </div>
                                <Button size="sm" disabled={isReadOnly} onClick={() => setIsAddAccountDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4" />Add Account</Button>
                            </CardHeader>
                            <CardContent>
                                {isLoadingAccounts ? <DataTableSkeleton /> :
                                    !accounts || accounts.length === 0 ? <div className="text-muted-foreground text-center p-4">No accounts found.</div> :
                                        (
                                            <div className="rounded-md border">
                                                <Table><TableHeader><TableRow><TableHead>Account Name</TableHead><TableHead className="text-right">Balance</TableHead><TableHead className="text-right w-[50px]">Actions</TableHead></TableRow></TableHeader>
                                                    <TableBody>
                                                        {accounts.map(acc => (
                                                            <TableRow key={acc.id}>
                                                                <TableCell>{acc.name}</TableCell>
                                                                <TableCell className="text-right font-medium">{formatCurrency(acc.balance)}</TableCell>
                                                                <TableCell className="text-right">
                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0" disabled={isReadOnly}><span className="sr-only">Open menu</span><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                                        <DropdownMenuContent align="end">
                                                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                                            <DropdownMenuItem onClick={() => handleEdit(acc, setEditingAccount, setIsEditAccountDialogOpen)} disabled={isReadOnly}><Edit className="mr-2 h-4 w-4" /><span>Edit</span></DropdownMenuItem>
                                                                            <DropdownMenuSeparator />
                                                                            <DropdownMenuItem onClick={() => handleDelete('petty_cash_accounts', acc.id, acc.name)} className="text-destructive focus:text-destructive" disabled={isReadOnly}><Trash2 className="mr-2 h-4 w-4" /><span>Delete</span></DropdownMenuItem>
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody></Table>
                                            </div>
                                        )}
                            </CardContent>
                        </Card>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Add New Source Account</DialogTitle>
                                <DialogDescription>Create a new account to track petty cash funds.</DialogDescription>
                            </DialogHeader>
                            <AddPettyCashAccountForm onFormSubmit={() => setIsAddAccountDialogOpen(false)} />
                        </DialogContent>
                    </Dialog>

                    {/* Item Categories */}
                    <Dialog open={isAddItemCategoryDialogOpen} onOpenChange={setIsAddItemCategoryDialogOpen}>
                        {renderTableSection(
                            "Item Categories",
                            "Manage inventory item categories.",
                            itemCategories,
                            isLoadingItemCategories,
                            () => setIsAddItemCategoryDialogOpen(true),
                            (item) => handleEdit(item, setEditingItemCategory, setIsEditItemCategoryDialogOpen),
                            'item_categories',
                            // @ts-ignore
                            List
                        )}
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Add Item Category</DialogTitle>
                                <DialogDescription>Create a new category for inventory items.</DialogDescription>
                            </DialogHeader>
                            <AddItemCategoryForm onFormSubmit={() => setIsAddItemCategoryDialogOpen(false)} />
                        </DialogContent>
                    </Dialog>

                    {/* Item Variations */}
                    <Dialog open={isAddItemVariationDialogOpen} onOpenChange={setIsAddItemVariationDialogOpen}>
                        {renderTableSection(
                            "Item Variations",
                            "Manage product variations (e.g., Size, Color).",
                            itemVariations,
                            isLoadingItemVariations,
                            () => setIsAddItemVariationDialogOpen(true),
                            (item) => handleEdit(item, setEditingItemVariation, setIsEditItemVariationDialogOpen),
                            'item_variations',
                            // @ts-ignore
                            List
                        )}
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Add Item Variation</DialogTitle>
                                <DialogDescription>Create a new variation type for items.</DialogDescription>
                            </DialogHeader>
                            <AddItemVariationForm onFormSubmit={() => setIsAddItemVariationDialogOpen(false)} />
                        </DialogContent>
                    </Dialog>

                    {/* Item Sections */}
                    <Dialog open={isAddItemSectionDialogOpen} onOpenChange={setIsAddItemSectionDialogOpen}>
                        {renderTableSection(
                            "Item Sections",
                            "Manage inventory item sections.",
                            itemSections,
                            isLoadingItemSections,
                            () => setIsAddItemSectionDialogOpen(true),
                            () => { },
                            'item_sections',
                            // @ts-ignore
                            List
                        )}
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Add Item Section</DialogTitle>
                                <DialogDescription>Create a new section for inventory items.</DialogDescription>
                            </DialogHeader>
                            <AddItemSectionForm onFormSubmit={() => setIsAddItemSectionDialogOpen(false)} />
                        </DialogContent>
                    </Dialog>
                </CardContent>
            </Card>

            {editingCurrency && (
                <Dialog open={isEditCurrencyDialogOpen} onOpenChange={setIsEditCurrencyDialogOpen}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Edit Currency</DialogTitle>
                            <DialogDescription>Update currency details.</DialogDescription>
                        </DialogHeader>
                        <EditCurrencyForm
                            initialData={editingCurrency}
                            onFormSubmit={() => setIsEditCurrencyDialogOpen(false)}
                        />
                    </DialogContent>
                </Dialog>
            )}

            {editingAccount && (
                <Dialog open={isEditAccountDialogOpen} onOpenChange={setIsEditAccountDialogOpen}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Edit Source Account</DialogTitle>
                            <DialogDescription>Update the details for the "{editingAccount.name}" account.</DialogDescription>
                        </DialogHeader>
                        <EditPettyCashAccountForm
                            initialData={editingAccount}
                            onFormSubmit={() => setIsEditAccountDialogOpen(false)}
                        />
                    </DialogContent>
                </Dialog>
            )}

            {editingCategory && (
                <Dialog open={isEditCategoryDialogOpen} onOpenChange={setIsEditCategoryDialogOpen}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Edit Transaction Category</DialogTitle>
                            <DialogDescription>Update the name for the "{editingCategory.name}" category.</DialogDescription>
                        </DialogHeader>
                        <EditPettyCashCategoryForm
                            initialData={editingCategory}
                            onFormSubmit={() => setIsEditCategoryDialogOpen(false)}
                        />
                    </DialogContent>
                </Dialog>
            )}

            {editingItemCategory && (
                <Dialog open={isEditItemCategoryDialogOpen} onOpenChange={setIsEditItemCategoryDialogOpen}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Edit Item Category</DialogTitle>
                            <DialogDescription>Update the name for the "{editingItemCategory.name}" category.</DialogDescription>
                        </DialogHeader>
                        <EditItemCategoryForm
                            initialData={editingItemCategory}
                            onFormSubmit={() => setIsEditItemCategoryDialogOpen(false)}
                        />
                    </DialogContent>
                </Dialog>
            )}

            {editingItemVariation && (
                <Dialog open={isEditItemVariationDialogOpen} onOpenChange={setIsEditItemVariationDialogOpen}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Edit Item Variation</DialogTitle>
                            <DialogDescription>Update the name for the "{editingItemVariation.name}" variation.</DialogDescription>
                        </DialogHeader>
                        <EditItemVariationForm
                            initialData={editingItemVariation}
                            onFormSubmit={() => setIsEditItemVariationDialogOpen(false)}
                        />
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
