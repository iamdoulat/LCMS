const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

async function run() {
    const admin = require('firebase-admin');
    // Use a hack to run this if standard init fails
    if (!admin.apps.length) {
        admin.initializeApp({
            projectId: 'nextsew-15d97'
        });
    }
    const db = admin.firestore();

    console.log("Fetching first 5 payslips...");
    const snapshot = await db.collection('payslips').limit(5).get();
    if (snapshot.empty) {
        console.log("No payslips found in the entire collection!");
        return;
    }

    snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`Payslip ID: ${doc.id}`);
        console.log(`- employeeId: ${data.employeeId}`);
        console.log(`- employeeCode: ${data.employeeCode}`);
        console.log(`- employeeName: ${data.employeeName}`);
        console.log(`- payPeriod: ${data.payPeriod}`);
        console.log("---");
    });

    const firstPayslip = snapshot.docs[0].data();
    if (firstPayslip.employeeId) {
        console.log(`Checking employee document for: ${firstPayslip.employeeId}`);
        const empDoc = await db.collection('employees').doc(firstPayslip.employeeId).get();
        if (empDoc.exists) {
            console.log(`Employee record exists. Email: ${empDoc.data().email}`);
        } else {
            console.log(`Employee record NOT FOUND for ID: ${firstPayslip.employeeId}`);
        }
    }
}

run().catch(console.error);
