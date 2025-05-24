
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Archive } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MissingAndFoundPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary")}>
            <Archive className="h-7 w-7 text-primary" />
            Missing and Found Items
          </CardTitle>
          <CardDescription>
            Track and manage items reported as missing or found.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>A list of missing and found items will be displayed here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
