
"use client";

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, AppWindow, AlertTriangle } from 'lucide-react';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';
import type { DemoMachineApplicationDocument } from '@/types';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { EditDemoMachineApplicationForm } from '@/components/forms/demo';
import { Badge } from '@/components/ui/badge';
import { parseISO, isValid, isPast, isFuture, isToday, startOfDay } from 'date-fns';

type CurrentDemoStatusPage = "Upcoming" | "Active" | "Overdue" | "Returned";

const getDemoStatusBadgeVariantPage = (status: CurrentDemoStatusPage): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "Active": return "default"; // Consider a success variant like green
    case "Overdue": return "destructive";
    case "Returned": return "secondary"; // e.g., gray or muted
    case "Upcoming": return "outline"; // e.g., default outline
    default: return "outline";
  }
};


export default function EditDemoMachineApplicationPage() {
  const params = useParams();
  const router = useRouter();
  const applicationId = params.applicationId as string;

  const [applicationData, setApplicationData] = React.useState<DemoMachineApplicationDocument | null>(null);
  const [isLoadingPage, setIsLoadingPage] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [currentDemoStatusPage, setCurrentDemoStatusPage] = React.useState<CurrentDemoStatusPage>("Upcoming");


  React.useEffect(() => {
    if (applicationId) {
      setIsLoadingPage(true);
      setError(null);
      const fetchApp = async () => {
        try {
          const docRef = doc(firestore, "demo_machine_applications", applicationId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data() as Omit<DemoMachineApplicationDocument, 'id'>;

            const processedAppliedMachines = Array.isArray(data.appliedMachines) ? data.appliedMachines.map(machine => ({
              demoMachineId: machine.demoMachineId || '', // Ensure demoMachineId is always a string
              machineModel: machine.machineModel || '',
              machineSerial: machine.machineSerial || '',
              machineBrand: machine.machineBrand || '',
            })) : [];

            const isTimestamp = (value: any): value is Timestamp => {
              return value && typeof value.toDate === 'function';
            };

            const appData = {
              id: docSnap.id,
              ...data,
              deliveryDate: isTimestamp(data.deliveryDate) ? data.deliveryDate.toDate().toISOString() : data.deliveryDate,
              estReturnDate: isTimestamp(data.estReturnDate) ? data.estReturnDate.toDate().toISOString() : data.estReturnDate,
              createdAt: isTimestamp(data.createdAt) ? data.createdAt.toDate().toISOString() : (data.createdAt as any),
              updatedAt: isTimestamp(data.updatedAt) ? data.updatedAt.toDate().toISOString() : (data.updatedAt as any),
              appliedMachines: processedAppliedMachines,
            } as DemoMachineApplicationDocument;
            setApplicationData(appData);

            // Calculate initial status for the badge
            if (appData.machineReturned) {
              setCurrentDemoStatusPage("Returned");
            } else {

              const delivery = appData.deliveryDate ? startOfDay(parseISO(appData.deliveryDate)) : null;
              const estReturn = appData.estReturnDate ? startOfDay(parseISO(appData.estReturnDate)) : null;

              if (delivery && estReturn && isValid(delivery) && isValid(estReturn)) {
                if (isPast(estReturn) && !isToday(estReturn)) setCurrentDemoStatusPage("Overdue");
                else if ((isToday(delivery) || isPast(delivery)) && (isToday(estReturn) || isFuture(estReturn))) setCurrentDemoStatusPage("Active");
                else if (isFuture(delivery)) setCurrentDemoStatusPage("Upcoming");
                else setCurrentDemoStatusPage("Upcoming");
              } else {
                setCurrentDemoStatusPage("Upcoming");
              }
            }

          } else {
            setError("Demo Machine Application not found.");
            Swal.fire("Error", `Application with ID ${applicationId} not found.`, "error").then(() => {
              router.push("/dashboard/demo/demo-machine-program");
            });
          }
        } catch (err: any) {
          console.error("Error fetching application data: ", err);
          setError(`Failed to fetch application data: ${err.message}`);
          Swal.fire("Error", `Failed to fetch application: ${err.message}`, "error");
        } finally {
          setIsLoadingPage(false);
        }
      };
      fetchApp();
    } else {
      setError("No Application ID provided.");
      setIsLoadingPage(false);
      Swal.fire("Error", "No Application ID specified.", "error").then(() => {
        router.push("/dashboard/demo/demo-machine-program");
      });
    }
  }, [applicationId, router]);

  const handleFormStatusChange = React.useCallback((status: CurrentDemoStatusPage) => {
    setCurrentDemoStatusPage(status);
  }, []);


  if (isLoadingPage) {
    return (
      <div className="container mx-auto py-8 flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading application details for ID: {applicationId}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-6xl mx-auto shadow-xl border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl font-bold text-destructive">
              <AlertTriangle className="h-7 w-7" />
              Error Loading Application
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive-foreground">{error}</p>
            <Button variant="outline" asChild className="mt-4">
              <Link href="/dashboard/demo/demo-machine-program">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Demo Machine Program
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!applicationData) {
    return (
      <div className="container mx-auto py-8 text-center">
        <p className="text-muted-foreground">Application data could not be loaded.</p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/dashboard/demo/demo-machine-program">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Demo Machine Program
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <Link href="/dashboard/demo/demo-machine-program" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Demo Machine Program
          </Button>
        </Link>
      </div>
      <Card className="max-w-6xl mx-auto shadow-xl">
        <CardHeader className="relative">
          <div className="absolute top-4 right-4 z-10">
            <Badge variant={getDemoStatusBadgeVariantPage(currentDemoStatusPage)} className="text-sm px-3 py-1">
              {currentDemoStatusPage}
            </Badge>
          </div>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 pr-24", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <AppWindow className="h-7 w-7 text-primary" />
            Edit Demo Machine Application
          </CardTitle>
          <CardDescription>
            Modify the details for application ID: <span className="font-semibold text-foreground">{applicationId}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditDemoMachineApplicationForm
            initialData={applicationData}
            applicationId={applicationId}
            onApplicationStatusChange={handleFormStatusChange}
          />
        </CardContent>
      </Card>
    </div>
  );
}
