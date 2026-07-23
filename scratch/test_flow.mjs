const baseUrl = 'https://vqutbhklwnvvpmvletqb.supabase.co/functions/v1/api';

console.log('Testing login endpoint...');
const loginRes = await fetch(`${baseUrl}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: '1001', password: '@LavaJato2026!' })
});

const loginData = await loginRes.json();
console.log('Login Status:', loginRes.status);
console.log('Login Data:', loginData.error ? loginData : { user: loginData.user?.name, role: loginData.user?.role, token: loginData.token ? 'YES' : 'NO' });

if (loginData.token) {
  console.log('\nTesting bootstrap endpoint with Bearer token...');
  const bootRes = await fetch(`${baseUrl}/bootstrap`, {
    headers: { 'Authorization': `Bearer ${loginData.token}` }
  });
  const bootData = await bootRes.json();
  console.log('Bootstrap Status:', bootRes.status);
  console.log('Bootstrap Services Count:', bootData.services?.length);
  console.log('Bootstrap Appointments Count:', bootData.appointments?.length);
  console.log('Bootstrap Current User:', bootData.currentUser?.name, bootData.currentUser?.role);
}
