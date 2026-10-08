// Using native fetch

const API_URL = 'http://localhost:3000/api/voice/process'; // Adjust as needed
const testCookie = process.env.TEST_COOKIE;
const testToken = process.env.TEST_TOKEN;

async function testIntent(transcript, type) {
  console.log(`\nTesting ${type}: "${transcript}"`);
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (testCookie) headers.Cookie = testCookie;
    else if (testToken) headers.Authorization = `Bearer ${testToken}`;

    const res = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ transcript, sessionId: 'test-123' })
    });
    const data = await res.json();
    console.log(`HTTP ${res.status}:`, data);
    if (!res.ok) process.exitCode = 1;
  } catch (err) {
    console.error('Error:', err.message);
    process.exitCode = 1;
  }
}

async function runTests() {
  if (!testCookie && !testToken) {
    console.error(
      'Set TEST_COOKIE to your session cookie or TEST_TOKEN to your bearer token. ' +
      'Without credentials, local development uses a separate Local developer account.'
    );
    process.exitCode = 1;
    return;
  }

  await testIntent("What is my current readiness score?", "Personal Data Question");
  await testIntent("Take me to day 5", "Navigation to specific day");
  await testIntent("Go to sprint 2", "Navigation to sprint");
  await testIntent("Where did I leave off yesterday?", "Fuzzy reference");
  await testIntent("Show me day 999", "Out of range day");
  await testIntent("Explain the difference between a process and a thread", "General Knowledge");
}

runTests();
