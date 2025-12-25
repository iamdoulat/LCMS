
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { FileText } from 'lucide-react';
import { createLazyComponent } from '@/lib/lazy-load';

// Lazy load the large form component (84KB)
const NewLCEntryForm = createLazyComponent(
  () => import('@/components/forms/financial').then(mod => ({ default: mod.NewLCEntryForm }))
);

export default function NewLCEntryPage() {
  return (
    <div className="container mx-auto py-8 px-5">
      <Card className="max-w-7xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <FileText className="h-7 w-7 text-primary" /> {/* Added icon */}
            Create New T/T OR L/C Entry
          </CardTitle>
          <CardDescription>
            Fill in the details below to add a new Letter of Credit. Fields marked with an asterisk (*) are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewLCEntryForm />
        </CardContent>
      </Card>
    </div>
  );
}
