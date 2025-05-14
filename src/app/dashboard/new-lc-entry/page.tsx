import { NewLCEntryForm } from '@/components/forms/NewLCEntryForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function NewLCEntryPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-4xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary">Create New L/C Entry</CardTitle>
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
