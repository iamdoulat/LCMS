
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AppWindow } from 'lucide-react'; // Kept AppWindow icon
import { cn } from '@/lib/utils';

export default function DemoMachineApplicationPage() { // Renamed function
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <AppWindow className="h-7 w-7 text-primary" /> {/* Kept AppWindow icon */}
            Demo Machine Application {/* Updated title */}
          </CardTitle>
          <CardDescription>
            Track applications and requests for demo machines. {/* Updated description */}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Information about demo machine applications will be displayed here.</p> {/* Updated placeholder content */}
        </CardContent>
      </Card>
    </div>
  );
}
