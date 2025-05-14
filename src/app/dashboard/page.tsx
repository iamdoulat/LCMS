
import { StatCard } from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Package, DollarSign, UsersRound, PieChart as PieChartIcon, CalendarDays, Search, ListFilter, TrendingUp } from 'lucide-react';
import { SupplierPieChart } from '@/components/dashboard/SupplierPieChart';
import { Separator } from '@/components/ui/separator';

export default function DashboardPage() {
  // Placeholder data - replace with actual data fetching
  const stats = {
    totalLCs: 125,
    totalLCValue: 5750000,
    activeSuppliers: 15,
    thisMonthLCQty: 22, // New stat
  };

  const supplierDistributionData = [
    { name: 'Supplier Alpha', value: 40, fill: 'hsl(var(--chart-1))' },
    { name: 'Supplier Beta', value: 30, fill: 'hsl(var(--chart-2))' },
    { name: 'Supplier Gamma', value: 20, fill: 'hsl(var(--chart-3))' },
    { name: 'Others', value: 10, fill: 'hsl(var(--chart-4))' },
  ];

  // Placeholder for upcoming shipments
  const upcomingShipments = [
    { lcNumber: 'LC-00123', supplier: 'Supplier Beta', latestShipmentDate: '2024-08-15' },
    { lcNumber: 'LC-00124', supplier: 'Supplier Alpha', latestShipmentDate: '2024-08-22' },
    { lcNumber: 'LC-00125', supplier: 'Supplier Gamma', latestShipmentDate: '2024-09-01' },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Dashboard Overview</h1>
        <div className="flex items-center gap-2">
          {/* Placeholder for potential date range filter or other actions */}
          {/* <Button variant="outline" className="text-sm">
            <ListFilter className="mr-2 h-4 w-4" />
            Filters
          </Button> */}
        </div>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total L/Cs"
          value={stats.totalLCs.toLocaleString()}
          icon={<Package className="h-7 w-7 text-primary" />}
          description="Total number of active Letters of Credit"
        />
        <StatCard
          title="Total L/C Value"
          value={`$${stats.totalLCValue.toLocaleString()}`}
          icon={<DollarSign className="h-7 w-7 text-primary" />}
          description="Combined value of all active L/Cs"
        />
        <StatCard
          title="Active Suppliers"
          value={stats.activeSuppliers.toLocaleString()}
          icon={<UsersRound className="h-7 w-7 text-primary" />}
          description="Number of unique suppliers involved"
        />
        <StatCard
          title="This Month's L/C Qty"
          value={stats.thisMonthLCQty.toLocaleString()}
          icon={<TrendingUp className="h-7 w-7 text-primary" />}
          description="L/Cs processed this current month"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-xl hover:shadow-2xl transition-shadow duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-semibold">
              <PieChartIcon className="h-6 w-6 text-primary" />
              Supplier L/C Distribution
            </CardTitle>
            <CardDescription>
              Visual breakdown of L/C value distribution among suppliers.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[350px] w-full">
            {supplierDistributionData.length > 0 ? (
              <SupplierPieChart data={supplierDistributionData} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">No supplier data available to display chart.</p>
              </div>
            )}
          </CardContent>
        </Card>
        
        <div className="lg:col-span-1 flex flex-col gap-6">
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                <Search className="h-6 w-6 text-accent" />
                Search L/C
              </CardTitle>
              <CardDescription>
                Find a specific L/C by its number.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex w-full items-center space-x-2">
                <Input type="text" placeholder="Enter L/C Number..." className="flex-1" />
                <Button type="submit" variant="outline">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
            <CardFooter>
                <p className="text-xs text-muted-foreground">
                    Search functionality is a UI placeholder.
                </p>
            </CardFooter>
          </Card>

          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                <CalendarDays className="h-6 w-6 text-accent" />
                Upcoming Shipments
              </CardTitle>
              <CardDescription>
                Key upcoming latest shipment dates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingShipments.length > 0 ? (
                <ul className="space-y-3">
                  {upcomingShipments.map((shipment, index) => (
                    <li key={index} className="text-sm">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-foreground">{shipment.lcNumber}</span>
                        <span className="text-muted-foreground">{new Date(shipment.latestShipmentDate).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Supplier: {shipment.supplier}</p>
                      {index < upcomingShipments.length - 1 && <Separator className="mt-2" />}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No upcoming shipments scheduled.</p>
              )}
            </CardContent>
             <CardFooter>
                <p className="text-xs text-muted-foreground">
                    Displaying top 3 upcoming shipments.
                </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}

