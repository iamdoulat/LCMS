
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Settings as SettingsIcon, Info } from 'lucide-react'; // Renamed to avoid conflict with component name
import { cn } from '@/lib/utils';

export default function SmtpSettingsPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <SettingsIcon className="h-7 w-7 text-primary" />
            SMTP Settings
          </CardTitle>
          <CardDescription>
            Configure email server settings for notifications and communication.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20">
            <Info className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-xl font-semibold text-muted-foreground">Content Under Development</p>
            <p className="text-sm text-muted-foreground">
              SMTP configuration options will be available here soon.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
