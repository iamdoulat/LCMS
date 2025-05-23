
import { NewLCEntryForm } from '@/components/forms/NewLCEntryForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function NewLCEntryPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-4xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>Create New L/C Entry</CardTitle>
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
