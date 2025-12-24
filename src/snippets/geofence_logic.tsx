
// Inside src/app/dashboard/account-details/page.tsx

// 1. Add state for Branch Data
const [employeeBranch, setEmployeeBranch] = useState<BranchDocument | null>(null);

// 2. Fetch Branch Data when employeeData is available
useEffect(() => {
    const fetchBranch = async () => {
        if (employeeData?.branchId) {
            try {
                const branchDoc = await getDoc(doc(firestore, 'branches', employeeData.branchId));
                if (branchDoc.exists()) {
                    setEmployeeBranch({ id: branchDoc.id, ...branchDoc.data() } as BranchDocument);
                }
            } catch (error) {
                console.error("Error fetching branch:", error);
            }
        }
    };
    fetchBranch();
}, [employeeData?.branchId]);

// 3. Helper function for Haversine Distance
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const d = R * c; // in metres
    return d;
}

// 4. Update submit handler to perform check
// ... inside handleSubmit ...
let status: 'Approved' | 'Pending' | 'Rejected' = 'Approved';
let distanceFromBranch = 0;
let isInsideGeofence = true;

if (employeeBranch && employeeBranch.latitude && employeeBranch.longitude && employeeBranch.allowRadius) {
    if (currentLocation) {
        distanceFromBranch = calculateDistance(
            currentLocation.latitude,
            currentLocation.longitude,
            employeeBranch.latitude,
            employeeBranch.longitude
        );
        isInsideGeofence = distanceFromBranch <= employeeBranch.allowRadius;

        if (!isInsideGeofence) {
            status = 'Pending';
            // We will show alert later
        }
    }
}

// ... call createCheckInOutRecord with additionalData ...

// 5. Show Alert if Pending
if (status === 'Pending') {
    Swal.fire({
        title: 'Attendance Forwarded',
        text: 'You are outside the allowed radius. Your attendance has been forwarded to your Supervisor/HR for review.',
        icon: 'warning'
    });
} else {
    Swal.fire({
        title: 'Success',
        text: `${checkInOutType} recorded successfully!`,
        icon: 'success'
    });
}

// 6. Render GeofenceMap in the UI above the Location text
