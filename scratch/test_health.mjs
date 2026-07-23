const response = await fetch('https://vqutbhklwnvvpmvletqb.supabase.co/functions/v1/api/health');
const data = await response.json();
console.log('Health Response:', data);
