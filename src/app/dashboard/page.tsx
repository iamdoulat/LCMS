import { StatCard } from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Package, DollarSign, UsersRound, Info } from 'lucide-react';

export default function DashboardPage() {
  // Placeholder data - replace with actual data fetching
  const stats = {
    totalLCs: 125,
    totalLCValue: 5750000,
    activeSuppliers: 15,
  };

  const supplierDistribution = [
    { name: 'Supplier Alpha', percentage: 40 },
    { name: 'Supplier Beta', percentage: 30 },
    { name: 'Supplier Gamma', percentage: 20 },
    { name: 'Others', percentage: 10 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard Overview</h1>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total L/Cs"
          value={stats.totalLCs.toLocaleString()}
          icon={<Package className="h-6 w-6 text-primary" />}
          description="Total number of active Letters of Credit"
        />
        <StatCard
          title="Total L/C Value"
          value={`$${stats.totalLCValue.toLocaleString()}`}
          icon={<DollarSign className="h-6 w-6 text-primary" />}
          description="Combined value of all active L/Cs"
        />
        <StatCard
          title="Active Suppliers"
          value={stats.activeSuppliers.toLocaleString()}
          icon={<UsersRound className="h-6 w-6 text-primary" />}
          description="Number of unique suppliers involved"
        />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersRound className="h-6 w-6 text-primary" />
              Supplier L/C Distribution
            </CardTitle>
            <CardDescription>
              Percentage of total L/C value by supplier.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {supplierDistribution.length > 0 ? (
              <ul className="space-y-3">
                {supplierDistribution.map((supplier) => (
                  <li key={supplier.name} className="flex justify-between items-center">
                    <span>{supplier.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-primary">{supplier.percentage}%</span>
                      <div className="h-2.5 w-32 rounded-full bg-secondary">
                        <div 
                          className="h-2.5 rounded-full bg-primary" 
                          style={{ width: `${supplier.percentage}%` }}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No supplier data available.</p>
            )}
            <p className="mt-4 text-sm text-muted-foreground flex items-center">
              <Info className="h-4 w-4 mr-2" />
              This is placeholder data. Integrate with backend for live supplier distribution.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
