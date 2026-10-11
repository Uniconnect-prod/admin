import { connectMongo, closeMongo, getReportingDb } from '../src/config/mongo.js';
import {
  maskMongoUri,
  validateMongoUri,
  testMongoConnection,
  discoverCollectionsAndSchema,
  createReadOnlyCollectionProxy,
  FORBIDDEN_WRITE_METHODS
} from '../src/config/mongoClientManager.js';
import { platformRepository } from '../src/services/platformRepository.js';
import { universalAnalyticsEngine } from '../src/services/universalAnalyticsEngine.js';
import { sourceDataService } from '../src/services/sourceDataService.js';
import { config } from '../src/config/index.js';

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASS: ${message}`);
  passedTests++;
}

async function runTestSuite() {
  console.log('\n===============================================================');
  console.log('🚀 ENTERPRISE MULTI-PLATFORM DYNAMIC SYSTEM VERIFICATION SUITE');
  console.log('===============================================================\n');

  await connectMongo();

  // -------------------------------------------------------------
  // TEST 1: STRICT READ-ONLY SECURITY PROXY ENFORCEMENT
  // -------------------------------------------------------------
  console.log('\n[1] Testing Strict Read-Only Database Security...');
  const mockCol = {
    find: () => ({ toArray: async () => [{ test: 1 }] }),
    insertOne: async () => ({ insertedId: 1 }),
    drop: async () => true
  };
  const readOnlyProxy = createReadOnlyCollectionProxy(mockCol, 'production_source', 'subscribers');

  let writeBlocked = false;
  try {
    await readOnlyProxy.insertOne({ unauthorized: 'mutation' });
  } catch (err) {
    if (err.message.includes('[SECURITY_VIOLATION]')) {
      writeBlocked = true;
    }
  }
  assert(writeBlocked, 'Write method insertOne is strictly intercepted and blocked by read-only proxy');

  let dropBlocked = false;
  try {
    await readOnlyProxy.drop();
  } catch (err) {
    if (err.message.includes('[SECURITY_VIOLATION]')) {
      dropBlocked = true;
    }
  }
  assert(dropBlocked, 'Collection drop operation is strictly intercepted and blocked by read-only proxy');

  // -------------------------------------------------------------
  // TEST 2: CREDENTIAL SANITIZATION & SECRET MASKING
  // -------------------------------------------------------------
  console.log('\n[2] Testing Credential Sanitization & URI Masking...');
  const rawSecretUri = 'mongodb+srv://admin_operator:SuperSecretPass123!@cluster0.abcde.mongodb.net/ghsuperwinings?retryWrites=true';
  const maskedUri = maskMongoUri(rawSecretUri);
  assert(
    !maskedUri.includes('SuperSecretPass123!') && maskedUri.includes('admin_operator:****@'),
    'Credentials in MongoDB URI are securely masked with ****'
  );

  // -------------------------------------------------------------
  // TEST 3: EXISTING PLATFORMS INTEGRITY & MIGRATION
  // -------------------------------------------------------------
  console.log('\n[3] Testing Migration & Baseline Platforms...');
  await platformRepository.ensurePlatformSchemas();

  const allPlatforms = await platformRepository.listAll(true);
  assert(allPlatforms.length >= 3, `Expected at least 3 configured platforms, found ${allPlatforms.length}`);

  const ghsw = allPlatforms.find(p => p.code === 'GHSUPERWININGS');
  assert(Boolean(ghsw), 'GHSUPERWININGS platform exists in admin registry');
  assert(ghsw.collections?.sdp_logs === 'sdplog', 'GHSUPERWININGS maps sdp_logs to sdplog');
  assert(ghsw.collections?.subscribers === 'users', 'GHSUPERWININGS maps subscribers to authoritative users collection');
  assert(Array.isArray(ghsw.offers) && ghsw.offers.length >= 2, 'GHSUPERWININGS has Daily and On-demand offer definitions');

  const gameium = allPlatforms.find(p => p.code === 'GHANAGAMEIUM');
  assert(Boolean(gameium), 'GHANAGAMEIUM platform exists in admin registry');
  assert(gameium.collections?.sdp_logs === 'sdplogs', 'GHANAGAMEIUM maps sdp_logs to sdplogs');
  assert(gameium.collections?.subscribers === 'subscriptions', 'GHANAGAMEIUM maps subscribers to subscriptions collection');

  // -------------------------------------------------------------
  // TEST 4: SUPERWINNINGS REPORT HISTORICAL FIDELITY
  // -------------------------------------------------------------
  console.log('\n[4] Validating SuperWinnings Report Financial Integrity...');
  const sepReport = await sourceDataService.getSubscriptionBusinessReport({
    platformCode: 'GHSUPERWININGS',
    startDate: '2026-09-01T00:00:00.000Z',
    endDate: '2026-09-14T23:59:59.999Z'
  });
  assert(Boolean(sepReport.totals), 'SuperWinnings business report returns structured totals');
  assert(sepReport.totals.grandTotal === 863.85, `Sept 1-14 grand total matches known benchmark of 863.85 (got ${sepReport.totals.grandTotal})`);

  // -------------------------------------------------------------
  // TEST 5: DYNAMIC PLATFORM REGISTRATION & VALIDATION LIFECYCLE
  // -------------------------------------------------------------
  console.log('\n[5] Testing Dynamic Registration of a New Platform without Backend Code Changes...');
  const testCode = `DYN_PORTAL_${Date.now().toString().slice(-4)}`;
  const newPlatformData = {
    name: 'Dynamic Test Gaming Portal',
    code: testCode,
    description: 'Dynamically registered platform for verification',
    country: 'Ghana',
    business_timezone: 'Africa/Accra',
    database_name: 'ghanagameium',
    collections: {
      subscribers: 'subscriptions',
      sdp_logs: 'sdplogs',
      callbacks: 'ghanacallbacklogs'
    },
    mappings: {
      msisdn: 'msisdn',
      timestamp: 'createdAt',
      transaction_id: 'transactionId',
      command: 'command',
      status: 'status',
      subscription_status: 'status',
      charge_amount: 'chargeAmount',
      offer_code: 'offerCode'
    },
    offers: [
      { code: '9923310007', name: 'GameZone Daily VIP', type: 'daily', price: 1.0, is_default: true }
    ]
  };

  const createdPlat = await platformRepository.createPlatform(newPlatformData);
  assert(Boolean(createdPlat?.id), `Dynamic platform created with ID ${createdPlat?.id}`);

  // Test dry-run validation on this new platform
  const valResult = await universalAnalyticsEngine.validatePlatformData(createdPlat);
  assert(valResult.isValid, 'Dry-run validation succeeds on dynamic platform');
  assert(valResult.metricsPreview.totalSubscribers > 0, `Detected ${valResult.metricsPreview.totalSubscribers} subscribers in target collection`);

  // Activate dynamic platform
  await platformRepository.activatePlatform(createdPlat.id);
  const activatedPlat = await platformRepository.findByIdOrCode(createdPlat.id);
  assert(activatedPlat.status === 'ACTIVE', 'Platform status transitioned to ACTIVE');

  // Verify that universal engine and sourceDataService can immediately query it
  const dynOverview = await sourceDataService.getOverview({ platformCode: testCode, range: '30d' });
  assert(Boolean(dynOverview.kpis), 'Overview KPIs successfully generated for new dynamic platform');
  assert(Boolean(dynOverview.kpis.totalSubscribers.value), `Dynamic platform returns subscriber count (${dynOverview.kpis.totalSubscribers.value})`);

  // Clean up: archive/disable test platform
  await platformRepository.disablePlatform(createdPlat.id);
  const disabledPlat = await platformRepository.findByIdOrCode(createdPlat.id);
  assert(disabledPlat.status === 'DISABLED', 'Platform safely disabled and archived');

  console.log('\n===============================================================');
  console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log('===============================================================\n');

  await closeMongo();
  process.exit(0);
}

runTestSuite().catch(err => {
  console.error('\n💥 TEST RUNNER FAILED WITH ERROR:', err);
  process.exit(1);
});
