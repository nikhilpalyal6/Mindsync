import dotenv from 'dotenv';
import mongoose from 'mongoose';
import mindMapService from '../../services/mindMap.service.js';
import resourceService from '../../services/resource.service.js';
import { connectDB, disconnectDB } from '../../database/connection.js';
import StudySession from '../../models/studySession.model.js';

dotenv.config();

async function runTests() {
  console.log('====================================================');
  console.log('STARTING MIND MAP ISOLATION FEATURE FLAG TESTS');
  console.log('====================================================');

  const testUserId = new mongoose.Types.ObjectId();
  const testWorkspaceId = new mongoose.Types.ObjectId();

  try {
    await connectDB();

    // ----------------------------------------------------
    // Test 1 — Automatic Trigger Skip Verification
    // ----------------------------------------------------
    console.log('\n[Test 1] Verifying automatic generation skips under AUTOMATIC_MIND_MAP_GENERATION=false...');
    process.env.AUTOMATIC_MIND_MAP_GENERATION = 'false';

    const mockResources = [
      {
        type: 'pdf',
        data: { extractedText: 'Valid meaningful text contents for mapping' }
      }
    ];

    const result = await mindMapService.generateWorkspaceMindMapBackground(
      testUserId.toString(),
      testWorkspaceId.toString(),
      'Test Workspace',
      mockResources,
      false // NOT manual (automatic)
    );

    if (result !== null) {
      throw new Error(`Expected automatic generation to return null when flag is disabled, got: ${JSON.stringify(result)}`);
    }
    console.log('✓ Test 1 Passed: Automatic generation was successfully skipped.');

    // ----------------------------------------------------
    // Test 2 — Manual Trigger Success Verification
    // ----------------------------------------------------
    console.log('\n[Test 2] Verifying manual generation bypasses the disable flag...');
    process.env.AUTOMATIC_MIND_MAP_GENERATION = 'false';

    // To prevent actual AI calls during manual check, we can check that it passes the guard check.
    // We override generateAIResponse or let it fail downstream but check that it bypassed the first line.
    let bypassedGuard = false;
    
    // Save original function
    const originalFilter = mindMapService.generateWorkspaceMindMapBackground;
    
    // We call the original function but check if it logs or executes past the flag guard.
    // Let's verify by checking that when we pass isManual = true, it doesn't return null at line 109.
    // To do this simply, since we pass an empty resources array, if it detects empty resources,
    // it will return null but will save an empty completed graph (updating MongoDB).
    // Let's pass an empty resources list. If it was blocked, it would return null and log nothing.
    // If it bypassed, it will perform findOneAndUpdate and log empty workspace detection!
    const resultManual = await mindMapService.generateWorkspaceMindMapBackground(
      testUserId.toString(),
      testWorkspaceId.toString(),
      'Test Workspace',
      [], // Empty resources list
      true // IS manual
    );

    // Verify it updated the DB (which means it got past the guard check!)
    const savedMap = await mongoose.model('MindMap').findOne({ workspaceId: testWorkspaceId, user: testUserId });
    if (!savedMap || savedMap.status !== 'COMPLETED') {
      throw new Error('Expected manual generation to proceed and update the database.');
    }
    
    console.log('✓ Test 2 Passed: Manual generation bypassed the guard and executed successfully.');

    // Clean up
    await mongoose.model('MindMap').deleteMany({ workspaceId: testWorkspaceId });
    await disconnectDB();

    console.log('\n====================================================');
    console.log('ALL MIND MAP ISOLATION TESTS PASSED SUCCESS');
    console.log('====================================================');

  } catch (err) {
    console.error('\n❌ Test failed:', err);
    await mongoose.model('MindMap').deleteMany({ workspaceId: testWorkspaceId });
    await disconnectDB();
    process.exit(1);
  }
}

runTests();
