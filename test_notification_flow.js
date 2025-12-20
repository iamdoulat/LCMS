// Test notification email flow
// This simulates what happens when an advance salary request is created

async function testNotificationFlow() {
    console.log('Testing notification flow...\n');

    // Simulate creating an advance salary request
    const testRequestId = 'test-' + Date.now();

    console.log('1. Creating test advance salary request (simulated)');
    console.log(`   Request ID: ${testRequestId}\n`);

    console.log('2. Calling /api/notify/advance-salary endpoint...');

    try {
        const response = await fetch('http://localhost:3000/api/notify/advance-salary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'new_request',
                requestId: 'aTmqC9WQTvn0zUWLvkQa', // Use an existing request ID from your Firestore
            })
        });

        const result = await response.json();
        console.log('   Response:', JSON.stringify(result, null, 2));

        if (result.success) {
            console.log('\n✅ SUCCESS: Admin notification should be sent to all Admin/HR users!');
        } else {
            console.log('\n❌ FAILED:', result.error || result.message);
        }

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
    }
}

testNotificationFlow();
