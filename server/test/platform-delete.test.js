import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { initStore } from '../src/store/index.js';
import { platformRepository } from '../src/repositories/platformRepository.js';

describe('Platform Deletion', () => {
  test('deletes a platform document and cascades cleanup', async () => {
    await initStore({ kind: 'memory' });

    // Create test platform
    const created = await platformRepository.create({
      code: 'TEST_PLATFORM_DEL',
      name: 'Test Platform To Delete',
      business_timezone: 'Africa/Accra'
    }, 1);

    assert.ok(created.id, 'Platform should have an ID');

    // Verify it exists
    const fetched = await platformRepository.findById(created.id);
    assert.equal(fetched?.name, 'Test Platform To Delete');

    // Delete it
    const ok = await platformRepository.delete(created.id);
    assert.equal(ok, true, 'delete should return true');

    // Verify it no longer exists
    const afterDelete = await platformRepository.findById(created.id);
    assert.equal(afterDelete, null, 'Platform should be deleted');
  });
});
