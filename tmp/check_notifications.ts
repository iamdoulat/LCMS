
import { admin } from '../src/lib/firebase/admin';

async function check() {
  console.log('--- START DIAGNOSTIC ---');
  
  const emailTemps = await admin.firestore().collection('email_templates').get();
  console.log('Email Templates:');
  emailTemps.docs.forEach(d => {
      const data = d.data();
      console.log(` - Slug: [${data.slug}] Active: ${data.isActive}`);
  });
  
  const waTemps = await admin.firestore().collection('whatsapp_templates').get();
  console.log('WhatsApp Templates:');
  waTemps.docs.forEach(d => {
      const data = d.data();
      console.log(` - Slug: [${data.slug}] Active: ${data.isActive}`);
  });

  const logs = await admin.firestore().collection('activity_log')
    .orderBy('timestamp', 'desc')
    .limit(50)
    .get();
  console.log('\nRecent Activity Logs:');
  logs.docs.forEach(d => {
      const data = d.data();
      console.log(` - [${data.type}] ${data.action} | ${data.status} | ${data.message} | Recipient: ${data.recipient || 'N/A'}`);
  });
  
  // Check recent claims
  const recentClaims = await admin.firestore().collection('hr_claims')
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();
  console.log('\nRecent Claims:');
  recentClaims.docs.forEach(d => {
      const data = d.data();
      console.log(` - No: ${data.claimNo} | Name: [${data.employeeName}] | Status: ${data.status} | ID: ${d.id}`);
  });

  console.log('--- END DIAGNOSTIC ---');
  process.exit(0);
}

check().catch(err => {
    console.error(err);
    process.exit(1);
});
