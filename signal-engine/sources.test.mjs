
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sources,
  isSourceApproved,
  getApprovedSources
} from './sources.mjs';

const approvedSource = {
  ...sources[0],
  enabled: true,
  permissionStatus: 'approved',
  commercialUseVerified: true,
  approvalReference: 'Fictional test approval'
};

test('rejects sources with pending permission', () => {
  assert.equal(isSourceApproved(sources[0]), false);
});

test('accepts fully approved source configuration', () => {
  assert.equal(isSourceApproved(approvedSource), true);
});

test('rejects disabled sources', () => {
  assert.equal(isSourceApproved({
    ...approvedSource,
    enabled: false
  }), false);
});

test('rejects unverified commercial usage', () => {
  assert.equal(isSourceApproved({
    ...approvedSource,
    commercialUseVerified: false
  }), false);
});

test('requires documented approval reference', () => {
  for (const reference of [null, '', '   ', 123]) {
    assert.equal(isSourceApproved({
      ...approvedSource,
      approvalReference: reference
    }), false);
  }
});

test('rejects malformed source records', () => {
  for (const source of [null, undefined, {}, 123]) {
    assert.equal(isSourceApproved(source), false);
  }
});

test('returns no approved sources by default', () => {
  assert.deepEqual(getApprovedSources(), []);
});
