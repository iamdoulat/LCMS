import { StatCard } from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Package, DollarSign, UsersRound, PieChart as PieChartIcon } from 'lucide-react'; // Renamed PieChart to PieChartIcon to avoid conflict
import { SupplierPieChart } from '@/components/dashboard/SupplierPieChart'; // Import the new pie chart component

export default function DashboardPage() {
  // Placeholder data - replace with actual data fetching
  const stats = {
    totalLCs: 125,
    totalLCValue: 5750000,
    activeSuppliers: 15,
  };

  const supplierDistributionData = [
    { name: 'Supplier Alpha', value: 40, fill: 'hsl(var(--chart-1))' },
    { name: 'Supplier Beta', value: 30, fill: 'hsl(var(--chart-2))' },
    { name: 'Supplier Gamma', value: 20, fill: 'hsl(var(--chart-3))' },
    { name: 'Others', value: 10, fill: 'hsl(var(--chart-4))' },
  ];

  return (
    <div className="flex flex-col gap-8"> {/* Increased gap */}
      <h1 className="text-4xl font-bold tracking-tight text-foreground">Dashboard Overview</h1>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total L/Cs"
          value={stats.totalLCs.toLocaleString()}
          icon={<Package className="h-7 w-7 text-primary" />} // Slightly larger icon
          description="Total number of active Letters of Credit"
        />
        <StatCard
          title="Total L/C Value"
          value={`$${stats.totalLCValue.toLocaleString()}`}
          icon={<DollarSign className="h-7 w-7 text-primary" />} // Slightly larger icon
          description="Combined value of all active L/Cs"
        />
        <StatCard
          title="Active Suppliers"
          value={stats.activeSuppliers.toLocaleString()}
          icon={<UsersRound className="h-7 w-7 text-primary" />} // Slightly larger icon
          description="Number of unique suppliers involved"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3 shadow-xl hover:shadow-2xl transition-shadow duration-300"> {/* Pie chart card takes more space */}
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-semibold">
              <PieChartIcon className="h-6 w-6 text-primary" /> {/* Using PieChartIcon */}
              Supplier L/C Distribution
            </CardTitle>
            <CardDescription>
              Visual breakdown of L/C value distribution among suppliers.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[350px] w-full"> {/* Ensure sufficient height for the chart */}
            {supplierDistributionData.length > 0 ? (
              <SupplierPieChart data={supplierDistributionData} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">No supplier data available to display chart.</p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Placeholder for another potential chart or info card */}
        <Card className="lg:col-span-2 shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-semibold">
              <UsersRound className="h-6 w-6 text-accent" />
              Key Metrics
            </CardTitle>
            <CardDescription>
              Additional important metrics at a glance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Average L/C Value</p>
                <p className="text-2xl font-bold text-foreground">$46,000</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cycle Time</p>
                <p className="text-2xl font-bold text-foreground">45 Days</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Upcoming Expiries (30d)</p>
                <p className="text-2xl font-bold text-destructive">5</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
