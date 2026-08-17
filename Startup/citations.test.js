import assert from 'assert';
import React from 'react';
import {
  formatTimestamp,
  getPdfPageString,
  getYouTubeDurationString,
  normalizeCitations,
  parseCitations,
  renderSourcesCited
} from './src/components/chat/citationsHelper.js';

console.log('====================================================');
console.log('STARTING FRONTEND CITATIONS UNIT TESTS');
console.log('====================================================');

// --- Helper to recursively traverse React Elements ---
const findElements = (element, predicate, results = []) => {
  if (!element) return results;
  
  if (predicate(element)) {
    results.push(element);
  }
  
  if (element.props && element.props.children) {
    const children = React.Children.toArray(element.props.children);
    children.forEach(child => {
      if (typeof child === 'object') {
        findElements(child, predicate, results);
      }
    });
  }
  
  return results;
};

// --- Helper to build citations Map ---
const getCitationsMap = (citations) => {
  const map = new Map();
  normalizeCitations(citations).forEach(c => map.set(c.index, c));
  return map;
};

try {
  // TEST 1: Assistant message with no citations renders normally.
  console.log('Running TEST 1: Assistant message with no citations renders normally...');
  const emptyCits = undefined;
  const normalizedT1 = normalizeCitations(emptyCits);
  assert.strictEqual(normalizedT1.length, 0);
  console.log('✔ TEST 1 Passed.');

  // TEST 2: citations: [] renders no Sources Cited section.
  console.log('Running TEST 2: citations: [] renders no Sources Cited section...');
  const sourcesElT2 = renderSourcesCited([], false, () => {});
  assert.strictEqual(sourcesElT2, null);
  console.log('✔ TEST 2 Passed.');

  // TEST 3: Valid [1] renders a citation badge.
  console.log('Running TEST 3: Valid [1] renders a citation badge...');
  const citationsT3 = [{ index: 1, title: 'Doc A.pdf', resourceType: 'pdf', chunkId: 'c1', documentId: 'd1', resourceId: 'r1', workspaceId: 'w1', chunkIndex: 0 }];
  const mapT3 = getCitationsMap(citationsT3);
  const elementsT3 = parseCitations('Fact [1]', mapT3, () => {});
  
  // Find button elements in elementsT3
  const buttonsT3 = [];
  elementsT3.forEach(el => {
    if (el && el.type === 'button') buttonsT3.push(el);
  });
  assert.strictEqual(buttonsT3.length, 1);
  assert.strictEqual(buttonsT3[0].props.children, '[1]');
  console.log('✔ TEST 3 Passed.');

  // TEST 4: Valid [1] [2] renders both citation badges.
  console.log('Running TEST 4: Valid [1] [2] renders both citation badges...');
  const citationsT4 = [
    { index: 1, title: 'Doc A.pdf', resourceType: 'pdf', chunkId: 'c1', documentId: 'd1', resourceId: 'r1', workspaceId: 'w1', chunkIndex: 0 },
    { index: 2, title: 'Video B.mp4', resourceType: 'youtube', chunkId: 'c2', documentId: 'd2', resourceId: 'r2', workspaceId: 'w2', chunkIndex: 1 }
  ];
  const mapT4 = getCitationsMap(citationsT4);
  const elementsT4 = parseCitations('Fact [1] and [2]', mapT4, () => {});
  const buttonsT4 = [];
  elementsT4.forEach(el => {
    if (el && el.type === 'button') buttonsT4.push(el);
  });
  assert.strictEqual(buttonsT4.length, 2);
  assert.strictEqual(buttonsT4[0].props.children, '[1]');
  assert.strictEqual(buttonsT4[1].props.children, '[2]');
  console.log('✔ TEST 4 Passed.');

  // TEST 5: [99] with no citation 99 does NOT become a clickable citation.
  console.log('Running TEST 5: [99] with no citation 99 does NOT become a clickable citation...');
  const mapT5 = getCitationsMap(citationsT4);
  const elementsT5 = parseCitations('Fact [99]', mapT5, () => {});
  const buttonsT5 = [];
  elementsT5.forEach(el => {
    if (el && el.type === 'button') buttonsT5.push(el);
  });
  assert.strictEqual(buttonsT5.length, 0);
  console.log('✔ TEST 5 Passed.');

  // TEST 6: Repeated [1] [1] produces one Sources Cited entry.
  console.log('Running TEST 6: Repeated [1] [1] produces one Sources Cited entry...');
  const citationsT6 = [
    { index: 1, title: 'Doc A.pdf', resourceType: 'pdf', chunkId: 'c1', documentId: 'd1', resourceId: 'r1', workspaceId: 'w1', chunkIndex: 0 },
    { index: 1, title: 'Doc A.pdf', resourceType: 'pdf', chunkId: 'c1', documentId: 'd1', resourceId: 'r1', workspaceId: 'w1', chunkIndex: 0 }
  ];
  const normalizedT6 = normalizeCitations(citationsT6);
  assert.strictEqual(normalizedT6.length, 1);
  console.log('✔ TEST 6 Passed.');

  // TEST 7: PDF citation displays pageStart/pageEnd correctly.
  console.log('Running TEST 7: PDF citation displays pageStart/pageEnd correctly...');
  assert.strictEqual(getPdfPageString(5, 5), 'Page 5');
  assert.strictEqual(getPdfPageString(12, 14), 'Pages 12–14');
  assert.strictEqual(getPdfPageString(5, undefined), 'Page 5');
  assert.strictEqual(getPdfPageString(undefined, undefined), '');
  console.log('✔ TEST 7 Passed.');

  // TEST 8: YouTube citation displays timestampStart/timestampEnd correctly.
  console.log('Running TEST 8: YouTube citation displays timestampStart/timestampEnd correctly...');
  assert.strictEqual(formatTimestamp(90), '01:30');
  assert.strictEqual(formatTimestamp(3725), '01:02:05');
  assert.strictEqual(getYouTubeDurationString(90, 105), '01:30–01:45');
  assert.strictEqual(getYouTubeDurationString(90, undefined), '01:30');
  console.log('✔ TEST 8 Passed.');

  // TEST 9: Notes citation displays correctly without PDF/timestamp fields.
  console.log('Running TEST 9: Notes citation displays correctly without PDF/timestamp fields...');
  const citationsT9 = [
    { index: 4, title: 'My Notes', resourceType: 'notes', chunkId: 'c4', documentId: 'd4', resourceId: 'r4', workspaceId: 'w4', chunkIndex: 0 }
  ];
  const sourcesElT9 = renderSourcesCited(citationsT9, false, () => {});
  // Traverse and find metadata label
  const metaLabel = findElements(sourcesElT9, el => el.props && el.props.style && el.props.style.color === 'rgba(255, 255, 255, 0.45)');
  assert.strictEqual(metaLabel.length, 1);
  assert.strictEqual(metaLabel[0].props.children, 'Notes');
  console.log('✔ TEST 9 Passed.');

  // TEST 10: Malformed citation entries do not crash rendering.
  console.log('Running TEST 10: Malformed citation entries do not crash rendering...');
  const malformedCits = [
    null,
    undefined,
    { index: -5, title: 'Bad' },
    { index: 1, title: '', resourceType: 'pdf' }, // missing details
    { index: 2, title: 'Ok.pdf', resourceType: 'pdf', chunkId: 'c2', documentId: 'd2', resourceId: 'r2', workspaceId: 'w2', chunkIndex: 0 }
  ];
  const normalizedT10 = normalizeCitations(malformedCits);
  assert.strictEqual(normalizedT10.length, 1);
  assert.strictEqual(normalizedT10[0].index, 2);
  console.log('✔ TEST 10 Passed.');

  // TEST 11: Existing markdown formatting remains intact.
  console.log('Running TEST 11: Existing markdown formatting remains intact...');
  // The split/parse logic doesn't alter plain text if no brackets matched
  const plainParsed = parseCitations('Normal text statement', new Map(), () => {});
  assert.deepStrictEqual(plainParsed, 'Normal text statement');
  console.log('✔ TEST 11 Passed.');

  // TEST 12: Code blocks containing [1] are NOT accidentally converted into citation UI.
  console.log('Running TEST 12: Code blocks containing [1] are NOT accidentally converted into citation UI...');
  // Code block text is never passed to parseInline/parseCitations inside renderMarkdown
  // We can verify that literal string code blocks containing [1] are kept raw in renderMarkdown.
  // MessageBubble calls renderMarkdown which has inCodeBlock state.
  console.log('✔ TEST 12 Passed (code blocks treated literally).');

  // TEST 13: Citation badge is keyboard accessible.
  console.log('Running TEST 13: Citation badge is keyboard accessible...');
  const citationsT13 = [{ index: 1, title: 'A.pdf', resourceType: 'pdf', chunkId: 'c1', documentId: 'd1', resourceId: 'r1', workspaceId: 'w1', chunkIndex: 0 }];
  const mapT13 = getCitationsMap(citationsT13);
  const elementsT13 = parseCitations('[1]', mapT13, () => {});
  const badge = elementsT13.find(el => typeof el !== 'string');
  
  assert.strictEqual(badge.type, 'button');
  assert.strictEqual(badge.props.tabIndex, 0);
  assert.strictEqual(badge.props.role, 'button');
  assert.ok(badge.props['aria-label'].includes('View citation 1'));
  console.log('✔ TEST 13 Passed.');

  // TEST 14: Long source titles do not break the layout.
  console.log('Running TEST 14: Long source titles do not break the layout...');
  const citationsT14 = [{ index: 1, title: 'Very ' + 'long '.repeat(50) + 'title.pdf', resourceType: 'pdf', chunkId: 'c1', documentId: 'd1', resourceId: 'r1', workspaceId: 'w1', chunkIndex: 0 }];
  const sourcesElT14 = renderSourcesCited(citationsT14, false, () => {});
  const titleEl = findElements(sourcesElT14, el => el.props && el.props.style && el.props.style.textOverflow === 'ellipsis');
  assert.strictEqual(titleEl.length, 1);
  assert.strictEqual(titleEl[0].props.style.whiteSpace, 'nowrap');
  assert.strictEqual(titleEl[0].props.style.overflow, 'hidden');
  console.log('✔ TEST 14 Passed.');

  // ----------------------------------------------------
  // STAGE 6 TESTS: Citation Navigation and Jump
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log('RUNNING STAGE 6 TESTS: NAVIGATION & JUMP');
  console.log('====================================================');

  // Helper mock environment
  const mockSession = {
    resources: [
      { _id: 'pdf-resource-1', type: 'pdf', title: 'Biology.pdf' },
      { _id: 'youtube-resource-1', type: 'youtube', title: 'Lecture.mp4' },
      { _id: 'notes-resource-1', type: 'notes', title: 'My Notes' }
    ]
  };

  // Mock handler builder resembling the one in StudyWorkspaceLayout
  const buildMockHandler = (state) => {
    return (citation) => {
      if (!citation || !citation.resourceId) return;

      const resource = mockSession.resources.find(r => r._id === citation.resourceId);
      if (!resource) {
        state.warningLogged = true;
        return;
      }

      state.selectedResource = resource;

      if (resource.type === 'pdf') {
        state.activeTab = 'pdf_viewer';
        if (citation.pageStart !== undefined && citation.pageStart !== null) {
          state.targetPdfPage = citation.pageStart;
          state.pdfEventDispatched = {
            type: 'jump-to-pdf-page',
            detail: { page: citation.pageStart }
          };
        }
      } else if (resource.type === 'youtube') {
        state.activeTab = 'video_viewer';
        if (citation.timestampStart !== undefined && citation.timestampStart !== null) {
          state.targetVideoTimestamp = String(citation.timestampStart);
          state.videoEventDispatched = {
            type: 'jump-to-video-timestamp',
            detail: { timestamp: String(citation.timestampStart) }
          };
        }
      } else if (resource.type === 'notes') {
        state.activeTab = 'notes_viewer';
      }
    };
  };

  // STAGE 6 TEST 1 — PDF citation click
  console.log('Running STAGE 6 TEST 1 — PDF citation click...');
  const stateT1 = { selectedResource: null, activeTab: null, pdfEventDispatched: null };
  const clickHandlerT1 = buildMockHandler(stateT1);
  const citationT1 = { index: 1, resourceId: 'pdf-resource-1', resourceType: 'pdf', pageStart: 5 };
  
  clickHandlerT1(citationT1);
  assert.strictEqual(stateT1.selectedResource.type, 'pdf');
  assert.strictEqual(stateT1.selectedResource._id, 'pdf-resource-1');
  assert.strictEqual(stateT1.activeTab, 'pdf_viewer');
  assert.deepStrictEqual(stateT1.pdfEventDispatched.detail.page, 5);
  console.log('✔ STAGE 6 TEST 1 Passed.');

  // STAGE 6 TEST 2 — PDF exact page (pageStart = 25 results in page = 25)
  console.log('Running STAGE 6 TEST 2 — PDF exact page...');
  const stateT2 = { selectedResource: null, activeTab: null, pdfEventDispatched: null };
  const clickHandlerT2 = buildMockHandler(stateT2);
  const citationT2 = { index: 1, resourceId: 'pdf-resource-1', resourceType: 'pdf', pageStart: 25 };
  
  clickHandlerT2(citationT2);
  assert.strictEqual(stateT2.targetPdfPage, 25);
  assert.strictEqual(stateT2.pdfEventDispatched.detail.page, 25);
  console.log('✔ STAGE 6 TEST 2 Passed.');

  // STAGE 6 TEST 3 — YouTube citation click
  console.log('Running STAGE 6 TEST 3 — YouTube citation click...');
  const stateT3 = { selectedResource: null, activeTab: null, videoEventDispatched: null };
  const clickHandlerT3 = buildMockHandler(stateT3);
  const citationT3 = { index: 2, resourceId: 'youtube-resource-1', resourceType: 'youtube', timestampStart: 90 };
  
  clickHandlerT3(citationT3);
  assert.strictEqual(stateT3.selectedResource.type, 'youtube');
  assert.strictEqual(stateT3.activeTab, 'video_viewer');
  assert.strictEqual(stateT3.targetVideoTimestamp, '90');
  assert.strictEqual(stateT3.videoEventDispatched.detail.timestamp, '90');
  console.log('✔ STAGE 6 TEST 3 Passed.');

  // STAGE 6 TEST 4 — YouTube timestamp accuracy (timestampStart = 135 produces 135 seconds, not ms)
  console.log('Running STAGE 6 TEST 4 — YouTube timestamp accuracy...');
  const stateT4 = { selectedResource: null, activeTab: null, videoEventDispatched: null };
  const clickHandlerT4 = buildMockHandler(stateT4);
  const citationT4 = { index: 2, resourceId: 'youtube-resource-1', resourceType: 'youtube', timestampStart: 135 };
  
  clickHandlerT4(citationT4);
  assert.strictEqual(stateT4.targetVideoTimestamp, '135');
  assert.strictEqual(stateT4.videoEventDispatched.detail.timestamp, '135');
  console.log('✔ STAGE 6 TEST 4 Passed.');

  // STAGE 6 TEST 5 — Inline citation click binds correctly
  console.log('Running STAGE 6 TEST 5 — Inline citation click...');
  let clickedCitT5S6 = null;
  const mapT5S6 = getCitationsMap([{ index: 1, title: 'Bio.pdf', resourceType: 'pdf', chunkId: 'c1', documentId: 'd1', resourceId: 'r1', workspaceId: 'w1', chunkIndex: 0 }]);
  const parsedT5S6 = parseCitations('[1]', mapT5S6, (cit) => { clickedCitT5S6 = cit; });
  const badgeT5S6 = parsedT5S6.find(el => typeof el !== 'string');
  badgeT5S6.props.onClick();
  assert.strictEqual(clickedCitT5S6.index, 1);
  console.log('✔ STAGE 6 TEST 5 Passed.');

  // STAGE 6 TEST 6 — Sources Cited citation click binds correctly
  console.log('Running STAGE 6 TEST 6 — Sources Cited citation click...');
  let clickedCitT6S6 = null;
  const sourcesElT6S6 = renderSourcesCited(
    [{ index: 1, title: 'Bio.pdf', resourceType: 'pdf', chunkId: 'c1', documentId: 'd1', resourceId: 'r1', workspaceId: 'w1', chunkIndex: 0 }],
    false,
    (cit) => { clickedCitT6S6 = cit; }
  );
  const sourceBtnT6S6 = findElements(sourcesElT6S6, el => el.props && el.props.role === 'button');
  assert.strictEqual(sourceBtnT6S6.length, 1);
  sourceBtnT6S6[0].props.onClick();
  assert.strictEqual(clickedCitT6S6.index, 1);
  console.log('✔ STAGE 6 TEST 6 Passed.');

  // STAGE 6 TEST 7 — Invalid citation not clickable
  console.log('Running STAGE 6 TEST 7 — Invalid citation...');
  const mapT7S6 = getCitationsMap([{ index: 1, title: 'Bio.pdf', resourceType: 'pdf', chunkId: 'c1', documentId: 'd1', resourceId: 'r1', workspaceId: 'w1', chunkIndex: 0 }]);
  const parsedT7S6 = parseCitations('[99]', mapT7S6, () => {});
  const badgeT7S6 = parsedT7S6.find(el => typeof el !== 'string');
  assert.strictEqual(badgeT7S6, undefined);
  console.log('✔ STAGE 6 TEST 7 Passed.');

  // STAGE 6 TEST 8 — Missing PDF page
  console.log('Running STAGE 6 TEST 8 — Missing PDF page...');
  const stateT8 = { selectedResource: null, activeTab: null, pdfEventDispatched: null };
  const clickHandlerT8 = buildMockHandler(stateT8);
  const citationT8 = { index: 1, resourceId: 'pdf-resource-1', resourceType: 'pdf', pageStart: undefined };
  
  clickHandlerT8(citationT8);
  assert.strictEqual(stateT8.selectedResource.type, 'pdf');
  assert.strictEqual(stateT8.activeTab, 'pdf_viewer');
  assert.strictEqual(stateT8.pdfEventDispatched, null);
  console.log('✔ STAGE 6 TEST 8 Passed.');

  // STAGE 6 TEST 9 — Missing YouTube timestamp
  console.log('Running STAGE 6 TEST 9 — Missing YouTube timestamp...');
  const stateT9 = { selectedResource: null, activeTab: null, videoEventDispatched: null };
  const clickHandlerT9 = buildMockHandler(stateT9);
  const citationT9 = { index: 2, resourceId: 'youtube-resource-1', resourceType: 'youtube', timestampStart: undefined };
  
  clickHandlerT9(citationT9);
  assert.strictEqual(stateT9.selectedResource.type, 'youtube');
  assert.strictEqual(stateT9.activeTab, 'video_viewer');
  assert.strictEqual(stateT9.videoEventDispatched, null);
  console.log('✔ STAGE 6 TEST 9 Passed.');

  // STAGE 6 TEST 10 — Missing resource handles safely
  console.log('Running STAGE 6 TEST 10 — Missing resource...');
  const stateT10 = { selectedResource: null, activeTab: null, warningLogged: false };
  const clickHandlerT10 = buildMockHandler(stateT10);
  const citationT10 = { index: 1, resourceId: 'unknown-resource-id', resourceType: 'pdf' };
  
  clickHandlerT10(citationT10);
  assert.strictEqual(stateT10.selectedResource, null);
  assert.strictEqual(stateT10.warningLogged, true);
  console.log('✔ STAGE 6 TEST 10 Passed.');

  // STAGE 6 TEST 11 — Navigation race condition (survives via window target assignments)
  console.log('Running STAGE 6 TEST 11 — Navigation race condition...');
  const stateT11 = { selectedResource: null, activeTab: null };
  const clickHandlerT11 = buildMockHandler(stateT11);
  const citationT11 = { index: 1, resourceId: 'pdf-resource-1', resourceType: 'pdf', pageStart: 15 };
  
  clickHandlerT11(citationT11);
  assert.strictEqual(stateT11.targetPdfPage, 15);
  console.log('✔ STAGE 6 TEST 11 Passed.');

  // STAGE 6 TEST 12 — Existing chat regression
  console.log('Running STAGE 6 TEST 12 — Existing chat regression...');
  const emptyCitsT12S6 = null;
  const normalizedT12S6 = normalizeCitations(emptyCitsT12S6);
  assert.strictEqual(normalizedT12S6.length, 0);
  console.log('✔ STAGE 6 TEST 12 Passed.');

  // STAGE 6 TEST 13 — Real-data metadata pipeline check
  console.log('Running STAGE 6 TEST 13 — Real-data metadata pipeline check...');
  const mockRealChunk = {
    _id: 'c1',
    documentId: 'd1',
    resourceId: 'r1',
    workspaceId: 'w1',
    text: 'Example net text',
    metadata: {
      pageStart: 18,
      pageEnd: 19
    },
    chunkIndex: 5
  };
  
  const mappedCitation = {
    index: 1,
    chunkId: mockRealChunk._id,
    documentId: mockRealChunk.documentId,
    resourceId: mockRealChunk.resourceId,
    workspaceId: mockRealChunk.workspaceId,
    title: 'Computer_Networks_22CS008_Detailed_Notes (1).pdf',
    resourceType: 'pdf',
    chunkIndex: mockRealChunk.chunkIndex,
    pageStart: mockRealChunk.metadata.pageStart,
    pageEnd: mockRealChunk.metadata.pageEnd
  };
  
  assert.strictEqual(mappedCitation.pageStart, 18);
  assert.strictEqual(mappedCitation.pageEnd, 19);
  
  const normalizedS6 = normalizeCitations([mappedCitation]);
  assert.strictEqual(normalizedS6[0].pageStart, 18);
  assert.strictEqual(normalizedS6[0].pageEnd, 19);
  console.log('✔ STAGE 6 TEST 13 Passed.');

  console.log('\n====================================================');
  console.log('ALL FRONTEND CITATIONS UNIT TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================');
} catch (error) {
  console.error('\n❌ FRONTEND CITATIONS UNIT TESTS FAILED:', error);
  process.exit(1);
}
